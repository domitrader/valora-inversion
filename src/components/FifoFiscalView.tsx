import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PortfolioState } from '../types/portfolio';
import {
  CustomFifoTransaction,
  FifoAssetSummary,
  FifoSaleSuggestion,
  generateTaxOptimizationPlan,
  parseTransactionsCsv,
  runFifoTaxEngine,
  simulateFifoSale,
} from '../utils/fifoTaxEngine';
import {
  Scale,
  Calculator,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Upload,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Info,
  Trash2,
  Zap,
  Wallet,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

interface FifoFiscalViewProps {
  portfolioState: PortfolioState;
}

const CUSTOM_TXS_STORAGE_KEY = 'valora_fifo_custom_txs_v1';

function formatEur(amount: number, showPlus = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : showPlus && safe > 0 ? '+' : '';
  const abs = Math.abs(safe);
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${withDots},${decPart} €`;
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0';
  if (Math.abs(qty - Math.round(qty)) < 1e-4) {
    return Math.round(qty).toLocaleString('es-ES');
  }
  return qty.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatDateEs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function normalizeBrokerLabel(raw?: string): string {
  const cleaned = (raw || '').trim();
  return cleaned.length > 0 ? cleaned : 'DEGIRO';
}

const KNOWN_BROKER_KEYWORDS = [
  'DEGIRO',
  'MyInvestor',
  'Kraken',
  'BBVA',
  'Bitvavo',
  'Coinbase',
  'Trade Republic',
  'Interactive Brokers',
  'IBKR',
  'Revolut',
  'Binance',
  'Indexa',
  'Openbank',
  'Renta 4',
  'ING',
  'Santander',
  'CaixaBank',
  'XTB',
  'eToro',
];

export const FifoFiscalView: React.FC<FifoFiscalViewProps> = ({ portfolioState }) => {
  // 1. Transacciones CSV personalizadas persistidas en localStorage
  const [customTransactions, setCustomTransactions] = useState<CustomFifoTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_TXS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (tx): tx is CustomFifoTransaction =>
              Boolean(tx && typeof tx === 'object' && typeof tx.date === 'string' && Number.isFinite(tx.quantity))
          );
        }
      }
    } catch {
      // ignore storage error
    }
    return [];
  });
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [csvBrokerTarget, setCsvBrokerTarget] = useState<string>('DEGIRO');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TXS_STORAGE_KEY, JSON.stringify(customTransactions));
    } catch {
      // ignore storage quota errors
    }
  }, [customTransactions]);

  // 2. Descubrir todos los brókers disponibles en positions, portfolios y customTransactions
  const discoveredBrokers = useMemo(() => {
    const map = new Map<string, string>();
    map.set('DEGIRO', 'DEGIRO');

    for (const pos of portfolioState.positions || []) {
      if (pos.broker && pos.broker.trim()) {
        const label = normalizeBrokerLabel(pos.broker);
        map.set(label.toUpperCase(), label);
      }
    }

    for (const pf of portfolioState.portfolios || []) {
      const name = (pf.name || '').trim();
      if (!name) continue;
      const matched = KNOWN_BROKER_KEYWORDS.find((kw) =>
        name.toLowerCase().includes(kw.toLowerCase())
      );
      if (matched) {
        map.set(matched.toUpperCase(), matched);
      }
    }

    for (const tx of customTransactions) {
      if (tx.broker && tx.broker.trim()) {
        const label = normalizeBrokerLabel(tx.broker);
        map.set(label.toUpperCase(), label);
      }
    }

    return Array.from(map.values());
  }, [portfolioState.positions, portfolioState.portfolios, customTransactions]);

  // Brókers seleccionados (DEGIRO activo por defecto)
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(['DEGIRO']);

  // Controles fiscales
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [consolidateByIsin, setConsolidateByIsin] = useState<boolean>(true);
  const [showIsinInfo, setShowIsinInfo] = useState<boolean>(false);
  const [showBrackets, setShowBrackets] = useState<boolean>(false);

  // Optimizador "Cero Impuestos" / "Sacar Liquidez"
  const [optimizerTab, setOptimizerTab] = useState<'compensar' | 'liquidez'>('compensar');
  const [selectedGainAssetKey, setSelectedGainAssetKey] = useState<string>('');
  const [hypotheticalSellQty, setHypotheticalSellQty] = useState<number>(0);
  const [manualExtraGain, setManualExtraGain] = useState<string>('');
  const [targetCashInput, setTargetCashInput] = useState<string>('1500');

  // Acordeón de activos y simulador individual
  const [expandedAssetKey, setExpandedAssetKey] = useState<string | null>(null);
  const [simStateByAsset, setSimStateByAsset] = useState<
    Record<string, { qty: number; price: string }>
  >({});

  // Acordeón de ventas ya cerradas en el año
  const [showClosedSales, setShowClosedSales] = useState<boolean>(false);

  // Ejecutar motor FIFO en tiempo real
  const engineResult = useMemo(() => {
    return runFifoTaxEngine({
      positions: portfolioState.positions || [],
      selectedBrokers: selectedBrokers.length > 0 ? selectedBrokers : ['DEGIRO'],
      fiscalYear,
      consolidateByIsin,
      customTransactions,
    });
  }, [
    portfolioState.positions,
    selectedBrokers,
    fiscalYear,
    consolidateByIsin,
    customTransactions,
  ]);

  // Activos con plusvalía latente disponibles para simular una venta hipotética en el optimizador
  const gainAssets = useMemo(
    () =>
      engineResult.assets
        .filter((a) => a.openQty > 1e-6 && a.unrealizedGainLossEur > 1)
        .sort((a, b) => b.unrealizedGainLossEur - a.unrealizedGainLossEur),
    [engineResult.assets]
  );

  // Sincronizar activo seleccionado en optimizador si desaparece al cambiar filtros
  const selectedGainAsset = useMemo(
    () => gainAssets.find((a) => a.groupKey === selectedGainAssetKey) || null,
    [gainAssets, selectedGainAssetKey]
  );

  // Limpiar estado expandido/seleccionado al cambiar criterio ISIN vs Por bolsa o brókers
  useEffect(() => {
    setExpandedAssetKey(null);
  }, [consolidateByIsin, selectedBrokers]);

  useEffect(() => {
    if (selectedGainAssetKey && !gainAssets.some((a) => a.groupKey === selectedGainAssetKey)) {
      setSelectedGainAssetKey('');
      setHypotheticalSellQty(0);
    }
  }, [gainAssets, selectedGainAssetKey]);

  // Calcular plusvalía hipotética del activo seleccionado
  const hypotheticalSaleSim = useMemo(() => {
    if (!selectedGainAsset || hypotheticalSellQty <= 0) return null;
    return simulateFifoSale(
      selectedGainAsset,
      hypotheticalSellQty,
      selectedGainAsset.currentPriceEur,
      new Date(),
      engineResult.yearSummary.computableNetEur,
      engineResult.fiscalYear
    );
  }, [selectedGainAsset, hypotheticalSellQty, engineResult]);

  const parsedManualGain = useMemo(() => {
    const val = parseFloat(manualExtraGain.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [manualExtraGain]);

  const totalExtraGainEur = useMemo(() => {
    const fromAsset =
      hypotheticalSaleSim && hypotheticalSaleSim.gainLossEur > 0
        ? hypotheticalSaleSim.gainLossEur
        : 0;
    return Math.round((fromAsset + parsedManualGain) * 100) / 100;
  }, [hypotheticalSaleSim, parsedManualGain]);

  const parsedTargetCash = useMemo(() => {
    const val = parseFloat(targetCashInput.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [targetCashInput]);

  // Plan de optimización en vivo
  const activePlan = useMemo(() => {
    if (optimizerTab === 'liquidez') {
      return generateTaxOptimizationPlan(engineResult, 0, parsedTargetCash);
    }
    return generateTaxOptimizationPlan(engineResult, totalExtraGainEur, 0);
  }, [engineResult, optimizerTab, totalExtraGainEur, parsedTargetCash]);

  // Handlers de brókers
  const toggleBroker = (broker: string) => {
    setSelectedBrokers((prev) => {
      const exists = prev.some((b) => b.toUpperCase() === broker.toUpperCase());
      if (exists) {
        if (prev.length === 1) return prev; // mantener al menos 1 activo
        return prev.filter((b) => b.toUpperCase() !== broker.toUpperCase());
      }
      return [...prev, broker];
    });
  };

  const selectAllBrokers = () => {
    setSelectedBrokers(discoveredBrokers);
  };

  // Handler subida CSV
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = parseTransactionsCsv(text, csvBrokerTarget || 'DEGIRO');
        if (parsed.length === 0) {
          setCsvFeedback({
            type: 'err',
            text: 'No se detectaron operaciones válidas en el CSV. Revisa las columnas (Fecha, Cantidad, ISIN/Producto).',
          });
        } else {
          setCustomTransactions((prev) => [...prev, ...parsed]);
          // Asegurar que el bróker destino esté activado
          setSelectedBrokers((prev) =>
            prev.some((b) => b.toUpperCase() === csvBrokerTarget.toUpperCase())
              ? prev
              : [...prev, csvBrokerTarget]
          );
          setCsvFeedback({
            type: 'ok',
            text: `Importadas ${parsed.length} operaciones para ${csvBrokerTarget}.`,
          });
        }
      } catch {
        setCsvFeedback({
          type: 'err',
          text: 'Error al leer el archivo CSV.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleClearCustomTxs = () => {
    setCustomTransactions([]);
    setCsvFeedback({ type: 'ok', text: 'Operaciones CSV personalizadas eliminadas.' });
  };

  // Helper para abrir/cerrar un activo e inicializar su simulador
  const toggleAssetCard = (asset: FifoAssetSummary) => {
    if (expandedAssetKey === asset.groupKey) {
      setExpandedAssetKey(null);
      return;
    }
    setExpandedAssetKey(asset.groupKey);
    setSimStateByAsset((prev) => {
      if (prev[asset.groupKey]) return prev;
      const defaultQty =
        asset.openQty > 1
          ? Math.max(1, Math.round(asset.openQty / 2))
          : Number(asset.openQty.toFixed(4));
      return {
        ...prev,
        [asset.groupKey]: {
          qty: Math.min(asset.openQty, defaultQty),
          price: asset.currentPriceEur > 0 ? asset.currentPriceEur.toFixed(2) : '0',
        },
      };
    });
  };

  const { yearSummary } = engineResult;

  const renderSuggestionCard = (s: FifoSaleSuggestion, accent: 'emerald' | 'amber' | 'violet') => {
    const styles = {
      emerald:
        'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/60',
      amber: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-800/60',
      violet: 'bg-violet-50/70 dark:bg-violet-950/30 border-violet-200/90 dark:border-violet-800/60',
    }[accent];

    const badgeStyles = {
      emerald: 'bg-emerald-600 text-white',
      amber: 'bg-amber-500 text-slate-950',
      violet: 'bg-violet-600 text-white',
    }[accent];

    return (
      <div
        key={`${s.category}-${s.groupKey}`}
        className={`rounded-2xl border p-3 space-y-1.5 ${styles}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black text-slate-950 dark:text-white truncate">
                {s.name}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                {s.ticker}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {s.isin} · {s.brokers.join(', ')}
            </div>
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${badgeStyles}`}>
            {s.isFullLiquidation ? '100% ISIN' : `Vender ${formatQty(s.qtyToSell)}`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
          <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-1.5 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">Efectivo</div>
            <div className="font-mono font-extrabold text-slate-900 dark:text-white">
              {formatEur(s.estimatedProceedsEur)}
            </div>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-1.5 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">P/G Fiscal</div>
            <div
              className={`font-mono font-extrabold ${
                s.estimatedGainLossEur < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatEur(s.estimatedGainLossEur, true)}
            </div>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-1.5 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[9px] uppercase font-bold text-slate-400">
              {s.estimatedTaxSavingsEur >= 0 ? 'Ahorro IRPF' : 'Coste IRPF'}
            </div>
            <div
              className={`font-mono font-extrabold ${
                s.estimatedTaxSavingsEur >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatEur(Math.abs(s.estimatedTaxSavingsEur))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-300 pt-0.5">
          <span className="font-semibold">
            Vender <span className="font-mono font-black">{formatQty(s.qtyToSell)}</span> de{' '}
            <span className="font-mono">{formatQty(s.totalOpenQty)}</span> uds
          </span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
            Fecha: {formatDateEs(s.recommendedExecutionDate)}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">{s.reason}</p>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* ==================== 1. PANEL DE BRÓKERS MODULAR + SUBIR CSV ==================== */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-xs font-black text-slate-950 dark:text-white">
              Brókers incluidos
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {discoveredBrokers.length > 1 && (
              <button
                type="button"
                onClick={
                  selectedBrokers.length === discoveredBrokers.length
                    ? () => setSelectedBrokers(['DEGIRO'])
                    : selectAllBrokers
                }
                className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {selectedBrokers.length === discoveredBrokers.length ? 'Solo DEGIRO' : 'Todos'}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition"
              title="Importar Transactions.csv de DEGIRO u otro bróker"
            >
              <Upload className="w-3 h-3" />
              Subir CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Chips modulares de brókers */}
        <div className="flex flex-wrap gap-1.5">
          {discoveredBrokers.map((broker) => {
            const active = selectedBrokers.some(
              (b) => b.toUpperCase() === broker.toUpperCase()
            );
            return (
              <button
                key={broker}
                type="button"
                onClick={() => toggleBroker(broker)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all border ${
                  active
                    ? 'bg-violet-600 text-white border-violet-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-300'
                }`}
              >
                {active ? '✓ ' : '+ '}
                {broker}
              </button>
            );
          })}
        </div>

        {/* Estado CSV personalizado */}
        {(customTransactions.length > 0 || csvFeedback) && (
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            {customTransactions.length > 0 && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  CSV cargado:{' '}
                  <span className="font-mono font-black text-violet-600 dark:text-violet-400">
                    {customTransactions.length}
                  </span>{' '}
                  operaciones
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={csvBrokerTarget}
                    onChange={(e) => setCsvBrokerTarget(e.target.value)}
                    className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg px-1.5 py-0.5 border border-slate-200 dark:border-slate-700"
                    title="Bróker para el próximo CSV"
                  >
                    {discoveredBrokers.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleClearCustomTxs}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar
                  </button>
                </div>
              </div>
            )}
            {csvFeedback && (
              <p
                className={`text-[10px] font-semibold ${
                  csvFeedback.type === 'ok'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {csvFeedback.text}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ==================== 2. CONTROLES FISCALES (AÑO + CRITERIO AEAT) ==================== */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
            Ejercicio fiscal
          </span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {engineResult.availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setFiscalYear(yr)}
                className={`px-2.5 py-1 rounded-xl font-mono text-xs font-black transition ${
                  fiscalYear === yr
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle Criterio Legal AEAT (Consolidado por ISIN) vs Por bolsa */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowIsinInfo((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 dark:text-slate-300"
            >
              <Scale className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              Criterio de agrupación
              <Info className="w-3 h-3 text-slate-400" />
            </button>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setConsolidateByIsin(true)}
                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition ${
                  consolidateByIsin
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                AEAT · ISIN
              </button>
              <button
                type="button"
                onClick={() => setConsolidateByIsin(false)}
                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition ${
                  !consolidateByIsin
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Por bolsa
              </button>
            </div>
          </div>

          {showIsinInfo && (
            <div className="p-2.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/70 dark:border-violet-800/50 text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-violet-700 dark:text-violet-300">Art. 37.2 LIRPF:</strong>{' '}
              Hacienda exige aplicar FIFO sobre <em>valores homogéneos</em> (mismo ISIN) con
              independencia de la bolsa (MIL, TDG, XET…) o bróker donde se hayan comprado. Usa{' '}
              <strong>Por bolsa</strong> solo como comparativa visual.
            </div>
          )}
        </div>
      </section>

      {/* ==================== 3. RESUMEN FISCAL DEL AÑO EN CURSO ==================== */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Resumen Fiscal {fiscalYear}
            </span>
            <h3 className="text-sm font-black text-slate-950 dark:text-white">
              Operaciones ya cerradas
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {yearSummary.salesCount} ventas
          </span>
        </div>

        {/* Plusvalías / Minusvalías */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/50 p-2.5">
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              Plusvalías realizadas
            </div>
            <div className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatEur(yearSummary.realizedGainsEur, true)}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/70 dark:border-rose-800/50 p-2.5">
            <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
              Minusvalías realizadas
            </div>
            <div className="text-sm font-mono font-black text-rose-700 dark:text-rose-300 mt-0.5">
              {formatEur(yearSummary.realizedLossesEur)}
            </div>
          </div>
        </div>

        {/* Neto FIFO real (antes de diferimientos Regla 2M) */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Neto FIFO real {fiscalYear}
            <span className="block text-[9px] font-medium text-slate-500 dark:text-slate-400">
              Plusvalías menos minusvalías cerradas
            </span>
          </div>
          <span
            className={`text-sm font-mono font-black ${
              yearSummary.realizedNetEur > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : yearSummary.realizedNetEur < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {formatEur(yearSummary.realizedNetEur, true)}
          </span>
        </div>

        {/* Pérdidas diferidas por regla 2 meses (destacado en ámbar si > 0) */}
        {yearSummary.deferredLossesEur > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300/80 dark:border-amber-700/60 p-2.5 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 text-[11px] space-y-1.5">
              <div className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                <span>+ Pérdidas diferidas (Regla 2M)</span>
                <span className="font-mono font-black">
                  +{formatEur(yearSummary.deferredLossesEur)}
                </span>
              </div>
              <p className="text-[10px] text-amber-800/90 dark:text-amber-300/90 leading-snug">
                Bloqueadas temporalmente por compra del mismo ISIN en ±2 meses (Art. 33.5.f LIRPF).
                Se suman al neto real ({formatEur(yearSummary.realizedNetEur, true)} +{' '}
                {formatEur(yearSummary.deferredLossesEur)} ={' '}
                <strong>{formatEur(yearSummary.computableNetEur, true)}</strong>) hasta que vendas
                los títulos recomprados.
              </p>

              {/* Desglose y fecha de desbloqueo por activo */}
              <div className="space-y-1 pt-1 border-t border-amber-300/50 dark:border-amber-700/50">
                {engineResult.assets
                  .filter((a) => a.deferredLossesYearEur > 0)
                  .map((a) => (
                    <div
                      key={a.groupKey}
                      className="rounded-lg bg-white/75 dark:bg-slate-900/60 px-2 py-1.5 text-[10px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-800 dark:text-slate-100">
                        <span className="truncate">
                          {a.ticker} ({a.isin})
                        </span>
                        <span className="font-mono text-amber-700 dark:text-amber-300 shrink-0">
                          {formatEur(a.deferredLossesYearEur)}
                        </span>
                      </div>
                      {a.washSale.status === 'bloqueada_ventana_anio' && a.washSale.unlockDate ? (
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                          ✓ Ventana libre a partir del{' '}
                          <span className="font-mono underline">
                            {formatDateEs(a.washSale.unlockDate)}
                          </span>{' '}
                          (puedes compensar vendiendo {a.ticker} desde MIL o TDG sin recomprar en 2
                          meses).
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-800 dark:text-amber-300 leading-snug">
                          Desbloqueo parcial:{' '}
                          <span className="font-mono font-bold">
                            {a.washSale.unlockDate ? formatDateEs(a.washSale.unlockDate) : '—'}
                          </span>{' '}
                          (o liquidando el 100% del ISIN sin recomprar en 2 meses).
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Base imponible computable + Cuota IRPF */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-[#12203B] to-violet-950 text-white p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Base imponible computable
              </div>
              <div
                className={`text-lg font-mono font-black ${
                  yearSummary.computableNetEur > 0
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}
              >
                {formatEur(yearSummary.computableNetEur, true)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Cuota IRPF est.
              </div>
              <div className="text-lg font-mono font-black text-white">
                {formatEur(yearSummary.taxEstimate.taxEur)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-300 pt-1.5 border-t border-white/10">
            <span>
              Tipo efectivo:{' '}
              <strong className="font-mono text-white">
                {(yearSummary.taxEstimate.effectiveRate * 100).toFixed(2)}%
              </strong>{' '}
              · Marginal:{' '}
              <strong className="font-mono text-white">
                {(yearSummary.taxEstimate.marginalRate * 100).toFixed(0)}%
              </strong>
            </span>
            {yearSummary.taxEstimate.breakdown.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBrackets((v) => !v)}
                className="inline-flex items-center gap-0.5 font-extrabold text-violet-300 hover:text-white transition"
              >
                Tramos
                {showBrackets ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {showBrackets && yearSummary.taxEstimate.breakdown.length > 0 && (
            <div className="pt-1.5 space-y-1 border-t border-white/10">
              {yearSummary.taxEstimate.breakdown.map((b) => (
                <div
                  key={b.bracket}
                  className="flex items-center justify-between text-[10px] text-slate-200"
                >
                  <span>{b.bracket}</span>
                  <span className="font-mono">
                    {formatEur(b.taxable)} → <strong>{formatEur(b.tax)}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ==================== 4. OPTIMIZADOR INTELIGENTE "CERO IMPUESTOS" ==================== */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-950 dark:text-white">
              Optimizador Inteligente "Cero Impuestos"
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Neutraliza plusvalías o saca liquidez pagando lo mínimo en IRPF
            </p>
          </div>
        </div>

        {/* Pestañas internas */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setOptimizerTab('compensar')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1 ${
              optimizerTab === 'compensar'
                ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            Compensar Plusvalía
          </button>
          <button
            type="button"
            onClick={() => setOptimizerTab('liquidez')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold transition flex items-center justify-center gap-1 ${
              optimizerTab === 'liquidez'
                ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Sacar Liquidez (€)
          </button>
        </div>

        {optimizerTab === 'compensar' ? (
          <div className="space-y-2.5">
            {/* Selector opcional de venta hipotética de activo en plusvalía */}
            {gainAssets.length > 0 && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 p-2.5 space-y-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  + Simular venta adicional en plusvalía (opcional)
                </label>
                <select
                  value={selectedGainAssetKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedGainAssetKey(key);
                    const found = gainAssets.find((a) => a.groupKey === key);
                    if (found) {
                      const defQty =
                        found.openQty > 1
                          ? Math.max(1, Math.round(found.openQty * 0.5))
                          : Number(found.openQty.toFixed(4));
                      setHypotheticalSellQty(Math.min(found.openQty, defQty));
                    } else {
                      setHypotheticalSellQty(0);
                    }
                  }}
                  className="w-full text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl px-2.5 py-2 border border-slate-200 dark:border-slate-700"
                >
                  <option value="">Solo compensar base ya realizada ({formatEur(yearSummary.computableNetEur)})</option>
                  {gainAssets.map((a) => (
                    <option key={a.groupKey} value={a.groupKey}>
                      {a.ticker} · {a.name} (Latente {formatEur(a.unrealizedGainLossEur, true)})
                    </option>
                  ))}
                </select>

                {selectedGainAsset && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">
                        Títulos a vender de {selectedGainAsset.ticker}:
                      </span>
                      <span className="font-mono font-black text-slate-950 dark:text-white">
                        {formatQty(hypotheticalSellQty)} / {formatQty(selectedGainAsset.openQty)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={selectedGainAsset.openQty}
                      step={
                        Math.abs(selectedGainAsset.openQty - Math.round(selectedGainAsset.openQty)) >
                        1e-4
                          ? Math.max(0.0001, selectedGainAsset.openQty / 100)
                          : 1
                      }
                      value={Math.min(selectedGainAsset.openQty, Math.max(0, hypotheticalSellQty))}
                      onChange={(e) => setHypotheticalSellQty(parseFloat(e.target.value) || 0)}
                      className="w-full accent-violet-600"
                    />
                    {hypotheticalSaleSim && (
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">
                          Efectivo: <strong>{formatEur(hypotheticalSaleSim.estimatedProceedsEur)}</strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                          Plusvalía FIFO: {formatEur(hypotheticalSaleSim.gainLossEur, true)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Importe manual de plusvalía extra */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  O introduce plusvalía extra manual (€)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="50"
                  placeholder="Ej. 1200"
                  value={manualExtraGain}
                  onChange={(e) => setManualExtraGain(e.target.value)}
                  className="w-full font-mono text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700"
                />
              </div>
              {totalExtraGainEur > 0 && (
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGainAssetKey('');
                      setHypotheticalSellQty(0);
                      setManualExtraGain('');
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Pestaña Sacar Liquidez (€) */
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
              ¿Cuánto efectivo (€) necesitas retirar?
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="100"
              placeholder="Ej. 1500"
              value={targetCashInput}
              onChange={(e) => setTargetCashInput(e.target.value)}
              className="w-full font-mono text-sm font-black bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700"
            />
            <div className="flex gap-1.5">
              {[500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTargetCashInput(String(amt))}
                  className="flex-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition"
                >
                  {amt.toLocaleString('es-ES')} €
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resultado del Plan de Optimización */}
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 p-3 space-y-2">
          <p className="text-[11px] font-bold text-emerald-950 dark:text-emerald-100 leading-snug">
            {activePlan.headline}
          </p>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2 border border-emerald-200/70 dark:border-emerald-800/40">
              <div className="text-[9px] font-bold uppercase text-slate-400">Ahorro IRPF</div>
              <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                {formatEur(activePlan.estimatedTaxSavingsEur)}
              </div>
            </div>
            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2 border border-emerald-200/70 dark:border-emerald-800/40">
              <div className="text-[9px] font-bold uppercase text-slate-400">IRPF Antes</div>
              <div className="text-xs font-mono font-black text-slate-700 dark:text-slate-300">
                {formatEur(activePlan.taxBeforePlanEur)}
              </div>
            </div>
            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2 border border-emerald-200/70 dark:border-emerald-800/40">
              <div className="text-[9px] font-bold uppercase text-slate-400">IRPF Final</div>
              <div className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300">
                {formatEur(activePlan.projectedTaxAfterPlanEur)}
              </div>
            </div>
          </div>
        </div>

        {/* Consejo claro destacado en verde: opción más factible para finales de año */}
        {(() => {
          const allCandidates = [
            ...activePlan.executableInYearWindow,
            ...activePlan.executableToday,
          ];
          const bestFeasible =
            allCandidates.length > 0
              ? allCandidates.reduce((best, curr) =>
                  Math.abs(curr.estimatedGainLossEur) > Math.abs(best.estimatedGainLossEur)
                    ? curr
                    : best
                )
              : null;

          const isWindowPick =
            bestFeasible != null &&
            activePlan.executableInYearWindow.some((s) => s.groupKey === bestFeasible.groupKey);

          return (
            <>
              {bestFeasible && activePlan.taxBeforePlanEur > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white p-3.5 shadow-sm border border-emerald-400/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      Consejo claro · Más factible fin de año {fiscalYear}
                    </span>
                    <span className="text-[10px] font-mono font-black bg-emerald-950/40 px-2 py-0.5 rounded-full">
                      Ahorro {formatEur(activePlan.estimatedTaxSavingsEur)}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold leading-snug">
                    {isWindowPick ? (
                      <>
                        Espera a la ventana del{' '}
                        <span className="underline decoration-emerald-200 font-mono">
                          {formatDateEs(bestFeasible.recommendedExecutionDate)}
                        </span>{' '}
                        al <span className="font-mono">31/12/{fiscalYear}</span> y vende{' '}
                        <span className="font-mono">
                          {formatQty(bestFeasible.qtyToSell)} uds
                        </span>{' '}
                        de <span className="font-mono">{bestFeasible.ticker}</span> (
                        {bestFeasible.isin}, desde MIL o TDG) para compensar{' '}
                        <span className="font-mono">
                          {formatEur(Math.abs(bestFeasible.estimatedGainLossEur))}
                        </span>{' '}
                        y dejar tu IRPF {fiscalYear} en{' '}
                        <span className="font-mono">
                          {formatEur(activePlan.projectedTaxAfterPlanEur)}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        Vende{' '}
                        <span className="font-mono">
                          {formatQty(bestFeasible.qtyToSell)} uds
                        </span>{' '}
                        de <span className="font-mono">{bestFeasible.ticker}</span> (
                        {bestFeasible.isin}) antes del{' '}
                        <span className="font-mono">31/12/{fiscalYear}</span> para compensar{' '}
                        <span className="font-mono">
                          {formatEur(Math.abs(bestFeasible.estimatedGainLossEur))}
                        </span>{' '}
                        y dejar tu IRPF en{' '}
                        <span className="font-mono">
                          {formatEur(activePlan.projectedTaxAfterPlanEur)}
                        </span>
                        .
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-emerald-50/95 leading-snug">
                    Recuerda no recomprar el mismo ISIN ({bestFeasible.isin}) durante los 2 meses
                    posteriores a la venta. Si quieres seguir expuesto al mismo activo, puedes rotar
                    a un ETF equivalente con distinto ISIN.
                  </p>
                </div>
              )}

              {/* Bloque 1: Ventana libre antes del 31/12 (marcada en VERDE si es la más factible para fin de año) */}
              {activePlan.executableInYearWindow.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>🟢 Recomendada fin de año (ventana libre antes del 31/12/{fiscalYear})</span>
                    </span>
                  </div>
                  {activePlan.executableInYearWindow.map((s) =>
                    renderSuggestionCard(
                      s,
                      bestFeasible && s.groupKey === bestFeasible.groupKey ? 'emerald' : 'amber'
                    )
                  )}
                </div>
              )}

              {/* Bloque 2: Ejecutable HOY */}
              {activePlan.executableToday.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                    <Clock className="w-4 h-4" />
                    <span>🟢 Disponible HOY (libre de regla 2 meses)</span>
                  </div>
                  {activePlan.executableToday.map((s) => renderSuggestionCard(s, 'emerald'))}
                </div>
              )}

              {/* Bloque 3: Alternativa Liquidación Total (100% del ISIN hoy) */}
              {activePlan.fullLiquidationAlternatives.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-violet-700 dark:text-violet-400">
                    <Zap className="w-4 h-4" />
                    <span>⚡ Alternativa Liquidación Total (100% del ISIN hoy)</span>
                  </div>
                  {activePlan.fullLiquidationAlternatives.map((s) =>
                    renderSuggestionCard(s, 'violet')
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* Aviso legal post-venta */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-2.5 flex items-start gap-2 text-[10px] text-slate-600 dark:text-slate-300 leading-snug">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>{activePlan.postSaleWarning}</span>
        </div>
      </section>

      {/* ==================== 5. ACTIVOS EN CARTERA, LOTES FIFO Y SIMULADOR ==================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black text-slate-900 dark:text-white">
            Activos en cartera y lotes FIFO ({engineResult.assets.filter((a) => a.openQty > 1e-6).length})
          </h3>
          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
            Latente:{' '}
            <span
              className={
                engineResult.netUnrealizedEur >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }
            >
              {formatEur(engineResult.netUnrealizedEur, true)}
            </span>
          </span>
        </div>

        {engineResult.assets.filter((a) => a.openQty > 1e-6).length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
            No hay posiciones abiertas para los brókers seleccionados.
          </div>
        ) : (
          engineResult.assets
            .filter((a) => a.openQty > 1e-6)
            .map((asset) => {
              const isExpanded = expandedAssetKey === asset.groupKey;
              const simInput = simStateByAsset[asset.groupKey] || {
                qty:
                  asset.openQty > 1
                    ? Math.min(asset.openQty, Math.max(1, Math.round(asset.openQty / 2)))
                    : Number(asset.openQty.toFixed(4)),
                price: asset.currentPriceEur > 0 ? asset.currentPriceEur.toFixed(2) : '0',
              };
              const effectiveSimQty = Math.min(
                asset.openQty,
                Math.max(0, Number.isFinite(simInput.qty) ? simInput.qty : 0)
              );
              const parsedSimPrice = parseFloat(simInput.price.replace(',', '.'));
              const effectivePrice =
                Number.isFinite(parsedSimPrice) && parsedSimPrice >= 0
                  ? parsedSimPrice
                  : asset.currentPriceEur;

              const simResult = isExpanded
                ? simulateFifoSale(
                    asset,
                    effectiveSimQty,
                    effectivePrice,
                    new Date(),
                    yearSummary.computableNetEur,
                    fiscalYear
                  )
                : null;

              const washBadge =
                asset.washSale.status === 'libre'
                  ? {
                      dot: '🟢',
                      label: 'Libre 2M',
                      cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/50',
                    }
                  : asset.washSale.status === 'bloqueada_ventana_anio'
                    ? {
                        dot: '🟡',
                        label: `Libre ${formatDateEs(asset.washSale.unlockDate)}`,
                        cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/50',
                      }
                    : {
                        dot: '🔴',
                        label: `Bloq. ${formatDateEs(asset.washSale.unlockDate)}`,
                        cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/50',
                      };

              const isFractional = Math.abs(asset.openQty - Math.round(asset.openQty)) > 1e-4;

              return (
                <div
                  key={asset.groupKey}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden"
                >
                  {/* Cabecera clickable del activo */}
                  <button
                    type="button"
                    onClick={() => toggleAssetCard(asset)}
                    className="w-full p-3.5 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-950 dark:text-white truncate">
                            {asset.name}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {asset.ticker}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{asset.isin}</span>
                          <span>·</span>
                          <span>{asset.brokers.join(', ')}</span>
                          {asset.exchanges.length > 0 && (
                            <>
                              <span>·</span>
                              <span>{asset.exchanges.join('/')}</span>
                            </>
                          )}
                          {!asset.hasGranularHistory && (
                            <span className="text-amber-600 dark:text-amber-400 font-sans font-bold">
                              (Estimado)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${washBadge.cls}`}
                        >
                          {washBadge.dot} {washBadge.label}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-[9px] font-bold uppercase text-slate-400">
                          Títulos / Coste FIFO
                        </div>
                        <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                          {formatQty(asset.openQty)} uds
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {formatEur(asset.openCostBasisEur)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase text-slate-400">
                          Valor actual
                        </div>
                        <div className="font-mono font-extrabold text-slate-900 dark:text-white">
                          {formatEur(asset.marketValueEur)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {formatEur(asset.currentPriceEur)}/ud
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold uppercase text-slate-400">
                          P/G Latente FIFO
                        </div>
                        <div
                          className={`font-mono font-black ${
                            asset.unrealizedGainLossEur >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatEur(asset.unrealizedGainLossEur, true)}
                        </div>
                        <div
                          className={`text-[10px] font-mono font-bold ${
                            asset.unrealizedGainLossPct >= 0
                              ? 'text-emerald-600/80 dark:text-emerald-400/80'
                              : 'text-rose-600/80 dark:text-rose-400/80'
                          }`}
                        >
                          {asset.unrealizedGainLossPct >= 0 ? '+' : ''}
                          {asset.unrealizedGainLossPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Panel expandido: Simulador FIFO + Tabla de Lotes Vivos */}
                  {isExpanded && simResult && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/60 dark:bg-slate-950/30">
                      {/* Explicación regla 2M del activo */}
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2 leading-snug">
                        {asset.washSale.summary}
                      </div>

                      {/* SIMULADOR DE VENTA FIFO */}
                      <div className="bg-white dark:bg-slate-900 border border-violet-200/80 dark:border-violet-800/60 rounded-2xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-violet-700 dark:text-violet-300 flex items-center gap-1">
                            <Calculator className="w-3.5 h-3.5" />
                            Simulador de venta FIFO
                          </span>
                          <div className="flex gap-1">
                            {[0.25, 0.5, 1].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const raw = asset.openQty * pct;
                                  const nextQty =
                                    pct === 1
                                      ? asset.openQty
                                      : isFractional
                                        ? Number(raw.toFixed(4))
                                        : Math.max(1, Math.round(raw));
                                  setSimStateByAsset((prev) => ({
                                    ...prev,
                                    [asset.groupKey]: { ...simInput, qty: Math.min(asset.openQty, nextQty) },
                                  }));
                                }}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold transition ${
                                  pct === 1
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {Math.round(pct * 100)}%
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Slider + inputs numéricos */}
                        <div className="space-y-1.5">
                          <input
                            type="range"
                            min={0}
                            max={asset.openQty}
                            step={isFractional ? Math.max(0.0001, asset.openQty / 100) : 1}
                            value={effectiveSimQty}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              setSimStateByAsset((prev) => ({
                                ...prev,
                                [asset.groupKey]: { ...(prev[asset.groupKey] || simInput), qty: q },
                              }));
                            }}
                            className="w-full accent-violet-600"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                Títulos a vender
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={asset.openQty}
                                step={isFractional ? '0.01' : '1'}
                                value={effectiveSimQty}
                                onChange={(e) => {
                                  const q = Math.min(
                                    asset.openQty,
                                    Math.max(0, parseFloat(e.target.value) || 0)
                                  );
                                  setSimStateByAsset((prev) => ({
                                    ...prev,
                                    [asset.groupKey]: { ...simInput, qty: q },
                                  }));
                                }}
                                className="w-full font-mono text-xs font-black bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase text-slate-400 mb-0.5">
                                Precio venta (€/ud)
                              </label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={simInput.price}
                                onChange={(e) => {
                                  setSimStateByAsset((prev) => ({
                                    ...prev,
                                    [asset.groupKey]: { ...simInput, price: e.target.value },
                                  }));
                                }}
                                className="w-full font-mono text-xs font-black bg-slate-50 dark:bg-slate-800 text-slate-950 dark:text-white rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Métricas en vivo de la simulación */}
                        <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-1.5">
                            <div className="text-[9px] font-bold uppercase text-slate-400">
                              Venta bruta
                            </div>
                            <div className="text-[11px] font-mono font-black text-slate-900 dark:text-white">
                              {formatEur(simResult.estimatedProceedsEur)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-1.5">
                            <div className="text-[9px] font-bold uppercase text-slate-400">
                              P/G Fiscal
                            </div>
                            <div
                              className={`text-[11px] font-mono font-black ${
                                simResult.gainLossEur >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatEur(simResult.gainLossEur, true)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-1.5">
                            <div className="text-[9px] font-bold uppercase text-slate-400">
                              IRPF Final
                            </div>
                            <div className="text-[11px] font-mono font-black text-violet-700 dark:text-violet-300">
                              {formatEur(simResult.taxImpact.taxAfterEur)}
                            </div>
                          </div>
                        </div>

                        {/* Estado regla 2 meses en la simulación */}
                        <div
                          className={`rounded-xl p-2 text-[10px] leading-snug border ${
                            simResult.washSaleBlocked
                              ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                              : simResult.isFullLiquidation && simResult.gainLossEur < 0
                                ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-violet-900 dark:text-violet-200'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
                          }`}
                        >
                          <div className="font-extrabold mb-0.5">
                            {simResult.isFullLiquidation && simResult.gainLossEur < 0
                              ? '⚡ Liquidación 100% activada — Pérdida 100% compensable'
                              : simResult.washSaleBlocked
                                ? '⚠️ Venta parcial bloqueada por regla 2 meses'
                                : '✓ Operación fiscalmente libre'}
                          </div>
                          <div>{simResult.washSaleNote}</div>
                          <div className="font-mono font-bold mt-1">
                            IRPF {fiscalYear}: {formatEur(simResult.taxImpact.taxBeforeEur)} →{' '}
                            {formatEur(simResult.taxImpact.taxAfterEur)} (
                            {simResult.taxImpact.taxDeltaEur >= 0
                              ? `ahorro ${formatEur(simResult.taxImpact.taxDeltaEur)}`
                              : `+${formatEur(Math.abs(simResult.taxImpact.taxDeltaEur))} cuota`}
                            )
                          </div>
                        </div>

                        {/* Lotes FIFO consumidos en la simulación */}
                        {simResult.consumedLots.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                              Lotes FIFO consumidos ({simResult.consumedLots.length})
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[10px] font-mono">
                                <thead>
                                  <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left py-1 font-sans">Compra</th>
                                    <th className="text-right py-1 font-sans">Uds</th>
                                    <th className="text-right py-1 font-sans">Coste/ud</th>
                                    <th className="text-right py-1 font-sans">P/G</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {simResult.consumedLots.map((c) => (
                                    <tr
                                      key={c.lotId}
                                      className="border-b border-slate-100/60 dark:border-slate-800/60"
                                    >
                                      <td className="py-1 text-slate-600 dark:text-slate-300">
                                        {formatDateEs(c.buyDate)}
                                      </td>
                                      <td className="py-1 text-right text-slate-800 dark:text-slate-200">
                                        {formatQty(c.qtyConsumed)}
                                      </td>
                                      <td className="py-1 text-right text-slate-600 dark:text-slate-300">
                                        {formatEur(c.unitCostEur)}
                                      </td>
                                      <td
                                        className={`py-1 text-right font-bold ${
                                          c.gainLossEur >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                        }`}
                                      >
                                        {formatEur(c.gainLossEur, true)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TABLA DE LOTES VIVOS FIFO */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                            Lotes vivos FIFO ({asset.openLots.length})
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Medio: {formatEur(asset.fifoAvgCostEur)}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] font-mono">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <th className="text-left py-1 font-sans">Fecha compra</th>
                                <th className="text-right py-1 font-sans">Títulos</th>
                                <th className="text-right py-1 font-sans">Coste/ud</th>
                                <th className="text-right py-1 font-sans">Coste total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {asset.openLots.map((lot) => (
                                <tr
                                  key={lot.lotId}
                                  className="border-b border-slate-100/60 dark:border-slate-800/60"
                                >
                                  <td className="py-1 text-slate-700 dark:text-slate-300">
                                    {formatDateEs(lot.buyDate)}
                                  </td>
                                  <td className="py-1 text-right font-bold text-slate-900 dark:text-white">
                                    {formatQty(lot.remainingQty)}
                                  </td>
                                  <td className="py-1 text-right text-slate-600 dark:text-slate-300">
                                    {formatEur(lot.unitCostEur)}
                                  </td>
                                  <td className="py-1 text-right font-bold text-slate-900 dark:text-white">
                                    {formatEur(lot.remainingCostEur)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </section>

      {/* ==================== 6. ACORDEÓN DE VENTAS YA CERRADAS EN EL AÑO ==================== */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowClosedSales((v) => !v)}
          className="w-full p-3.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-950 dark:text-white">
                Ventas cerradas en {fiscalYear} ({engineResult.realizedEventsYear.length})
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Detalle fiscal FIFO y pérdidas diferidas por regla 2M
              </div>
            </div>
          </div>
          {showClosedSales ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {showClosedSales && (
          <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
            {engineResult.realizedEventsYear.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No constan ventas cerradas en {fiscalYear} para los brókers seleccionados.
              </p>
            ) : (
              engineResult.realizedEventsYear.map((ev) => (
                <div
                  key={ev.eventId}
                  className={`rounded-xl border p-2.5 space-y-1 ${
                    ev.washSaleDeferred
                      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate block">
                        {ev.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {formatDateEs(ev.sellDate)} · {formatQty(ev.qtySold)} uds · {ev.broker}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-mono font-black ${
                          ev.gainLossEur >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatEur(ev.gainLossEur, true)}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">
                        Venta {formatEur(ev.totalProceedsEur)}
                      </div>
                    </div>
                  </div>

                  {ev.washSaleDeferred && (
                    <div className="pt-1 border-t border-amber-200/70 dark:border-amber-800/50 text-[10px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        <strong>Pérdida diferida ({formatEur(ev.deferredLossEur)}):</strong>{' '}
                        {ev.washSaleReason || 'Compra homogénea en ventana de ±2 meses (Art. 33.5.f LIRPF).'}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* ==================== 7. AVISO LEGAL BREVE ==================== */}
      <footer className="rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 p-3 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
        Cálculo orientativo basado en la normativa española del IRPF (Ley 35/2006, Art. 37.2 criterio
        FIFO homogéneo por ISIN y Art. 33.5.f regla antiaplicación de 2 meses). No constituye
        asesoramiento fiscal vinculante; consulta con un asesor fiscal antes de presentar tu
        declaración de la Renta.
      </footer>
    </div>
  );
};
