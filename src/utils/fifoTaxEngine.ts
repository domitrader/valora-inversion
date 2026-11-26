import { AssetType, PositionItem } from '../types/portfolio';
import rawDegiroTransactions from '../data/degiroAssetTransactions.json';
import { detectCsvDelimiter, sanitizeFinancialNumber, splitCsvRow } from './brokerParsers';

// ============================================================================
// TIPOS EXPORTADOS DEL MOTOR FISCAL FIFO (ESPAÑA - AEAT / LIRPF)
// ============================================================================

export type WashSaleStatus = 'libre' | 'bloqueada_ventana_anio' | 'bloqueada_fuera_anio';

export interface SpanishTaxBracketDetail {
  bracket: string;
  taxable: number;
  rate: number;
  tax: number;
}

export interface SpanishSavingsTaxResult {
  taxEur: number;
  effectiveRate: number;
  marginalRate: number;
  breakdown: SpanishTaxBracketDetail[];
}

export interface CustomFifoTransaction {
  id?: string;
  /** Fecha en formato YYYY-MM-DD o DD-MM-YYYY */
  date: string;
  /** Hora opcional HH:MM */
  time?: string;
  isin: string;
  name: string;
  ticker?: string;
  broker: string;
  exchange?: string;
  positionId?: string;
  /** > 0 compra, < 0 venta */
  quantity: number;
  /** Precio unitario en moneda de cotización o EUR */
  price: number;
  /** Comisiones + AutoFX totales en EUR (valor positivo) */
  feesEur: number;
  /** Importe neto total en EUR (negativo en compras, positivo en ventas, ya incluye feesEur) */
  netEur: number;
  assetType?: AssetType;
}

export interface FifoLot {
  lotId: string;
  /** Fecha de adquisición ISO YYYY-MM-DD */
  buyDate: string;
  buyTime: string;
  buyTimestamp: number;
  originalQty: number;
  remainingQty: number;
  /** Coste unitario fiscal en EUR (incluyendo comisiones de compra y AutoFX) */
  unitCostEur: number;
  /** Coste total restante en EUR */
  remainingCostEur: number;
  /** Comisión proporcional restante en EUR */
  remainingFeesEur: number;
  broker: string;
  exchange: string;
  positionId: string;
  /** True si el lote procede de una posición sin historial granular (estimado por precio medio) */
  isEstimated: boolean;
}

export interface FifoConsumedLotDetail {
  lotId: string;
  buyDate: string;
  qtyConsumed: number;
  unitCostEur: number;
  costBasisEur: number;
  proceedsEur: number;
  gainLossEur: number;
  holdingDays: number;
}

export interface FifoRealizedEvent {
  eventId: string;
  groupKey: string;
  isin: string;
  name: string;
  ticker: string;
  broker: string;
  exchange: string;
  positionId: string;
  /** Fecha de venta ISO YYYY-MM-DD */
  sellDate: string;
  sellTime: string;
  fiscalYear: number;
  qtySold: number;
  unitProceedsEur: number;
  /** Importe neto de venta en EUR (descontadas comisiones de venta y AutoFX) */
  totalProceedsEur: number;
  /** Coste de adquisición FIFO en EUR (incluyendo comisiones de compra) */
  costBasisEur: number;
  sellFeesEur: number;
  /** Ganancia (>0) o pérdida (<0) patrimonial fiscal en EUR */
  gainLossEur: number;
  consumedLots: FifoConsumedLotDetail[];
  /** Regla antiaplicación 2 meses (Art. 33.5.f LIRPF) */
  washSaleDeferred: boolean;
  deferredLossEur: number;
  blockedQty: number;
  washSaleReason?: string;
}

export interface WashSaleAssessment {
  status: WashSaleStatus;
  /** Fecha ISO de la última compra del ISIN (null si no hay compras registradas) */
  lastBuyDate: string | null;
  /** Primer día libre tras cumplirse 2 meses desde la última compra (ISO YYYY-MM-DD) */
  unlockDate: string | null;
  /** Días restantes desde referenceDate hasta unlockDate (0 si ya está libre) */
  daysUntilUnlock: number;
  /** True si unlockDate cae dentro del ejercicio fiscal analizado (<= 31/12) */
  unlocksBeforeYearEnd: boolean;
  /** Número de días disponibles en la ventana libre antes de fin de año (si aplica) */
  windowDaysBeforeYearEnd: number;
  /** Siempre se puede evitar el bloqueo vendiendo el 100% del ISIN y no recomprando en 2 meses */
  canBypassWithFullLiquidation: boolean;
  /** Cantidad de títulos adquiridos en los últimos 2 meses respecto a referenceDate */
  recentBuysQty: number;
  /** Explicación legible en español */
  summary: string;
}

export interface FifoAssetSummary {
  /** Clave de agrupación: ISIN si consolidateByIsin=true, o positionId si false */
  groupKey: string;
  isin: string;
  name: string;
  ticker: string;
  assetType: AssetType;
  brokers: string[];
  exchanges: string[];
  positionIds: string[];
  /** True si hay historial real de transacciones; false si es lote sintético estimado */
  hasGranularHistory: boolean;
  /** Cantidad abierta actual según FIFO */
  openQty: number;
  /** Coste base FIFO total de los títulos abiertos en EUR */
  openCostBasisEur: number;
  /** Precio medio fiscal FIFO en EUR */
  fifoAvgCostEur: number;
  /** Precio actual de mercado en EUR */
  currentPriceEur: number;
  /** Valor de mercado actual en EUR */
  marketValueEur: number;
  /** Plusvalía (+) o minusvalía (-) latente fiscal según FIFO */
  unrealizedGainLossEur: number;
  unrealizedGainLossPct: number;
  /** Lotes abiertos ordenados del más antiguo al más reciente (FIFO estricto) */
  openLots: FifoLot[];
  /** Métricas realizadas en el año fiscal seleccionado */
  realizedGainsYearEur: number;
  realizedLossesYearEur: number;
  realizedNetYearEur: number;
  deferredLossesYearEur: number;
  computableNetYearEur: number;
  realizedEventsYear: FifoRealizedEvent[];
  /** Todas las ventas históricas cerradas de este activo */
  allRealizedEvents: FifoRealizedEvent[];
  /** Total comisiones pagadas en el año fiscal */
  feesYearEur: number;
  /** Evaluación regla antiaplicación de 2 meses para futuras ventas con pérdida */
  washSale: WashSaleAssessment;
}

export interface FifoYearSummary {
  fiscalYear: number;
  salesCount: number;
  realizedGainsEur: number;
  realizedLossesEur: number;
  /** Neto bruto realizado (plusvalías + minusvalías) sin descontar diferimientos */
  realizedNetEur: number;
  /** Pérdidas del año bloqueadas/diferidas por regla de los 2 meses (valor positivo o 0) */
  deferredLossesEur: number;
  /** Base imponible neta computable en IRPF (realizedNetEur + deferredLossesEur) */
  computableNetEur: number;
  feesYearEur: number;
  taxEstimate: SpanishSavingsTaxResult;
  /** Estimación de IRPF si no hubiera pérdidas diferidas (escenario 100% liberado) */
  taxEstimateWithoutDeferral: SpanishSavingsTaxResult;
}

export interface FifoSaleSimulationResult {
  groupKey: string;
  isin: string;
  name: string;
  ticker: string;
  qtyRequested: number;
  qtySimulated: number;
  isFullLiquidation: boolean;
  pricePerShareEur: number;
  estimatedProceedsEur: number;
  costBasisEur: number;
  gainLossEur: number;
  consumedLots: FifoConsumedLotDetail[];
  remainingQtyAfterSale: number;
  washSaleEffectiveStatus: WashSaleStatus;
  washSaleBlocked: boolean;
  washSaleNote: string;
  /** Impacto estimado sobre la factura IRPF del ejercicio */
  taxImpact: {
    netBeforeEur: number;
    netAfterEur: number;
    taxBeforeEur: number;
    taxAfterEur: number;
    /** Positivo = ahorro fiscal; Negativo = impuesto adicional a pagar */
    taxDeltaEur: number;
  };
}

export interface FifoSaleSuggestion {
  category: 'executable_today' | 'executable_year_window' | 'full_liquidation_alternative';
  groupKey: string;
  isin: string;
  name: string;
  ticker: string;
  brokers: string[];
  exchanges: string[];
  qtyToSell: number;
  totalOpenQty: number;
  isFullLiquidation: boolean;
  currentPriceEur: number;
  estimatedProceedsEur: number;
  costBasisEur: number;
  /** Pérdida (negativa) o ganancia (positiva) fiscal generada */
  estimatedGainLossEur: number;
  /** Ahorro fiscal estimado en EUR por esta operación */
  estimatedTaxSavingsEur: number;
  washSaleStatus: WashSaleStatus;
  recommendedExecutionDate: string;
  reason: string;
  consumedLots: FifoConsumedLotDetail[];
}

export interface FifoRecommendationPlan {
  fiscalYear: number;
  mode: 'zero_tax' | 'target_cash';
  currentRealizedNetEur: number;
  currentComputableNetEur: number;
  targetExtraGainEur: number;
  targetCashEur: number;
  /** Plusvalía neta objetivo que conviene compensar para dejar la factura IRPF a 0 € */
  targetLossNeededEur: number;
  taxBeforePlanEur: number;
  /** Pérdida máxima compensable HOY sin bloqueo */
  offsetAvailableTodayEur: number;
  /** Pérdida adicional compensable en ventana libre antes del 31/12 */
  offsetAvailableInWindowEur: number;
  /** Pérdida total compensable combinando hoy + ventana del año */
  totalOffsetPlannedEur: number;
  projectedNetAfterPlanEur: number;
  projectedTaxAfterPlanEur: number;
  estimatedTaxSavingsEur: number;
  projectedCashGeneratedEur: number;
  /** 1. Ejecutables HOY sin bloqueo */
  executableToday: FifoSaleSuggestion[];
  /** 2. Ejecutables en ventana libre antes del 31/12 (ej. Gold 3X desde 23/12/2026) */
  executableInYearWindow: FifoSaleSuggestion[];
  /** 3. Alternativa de liquidación total (100% del ISIN sin recomprar en 2 meses) */
  fullLiquidationAlternatives: FifoSaleSuggestion[];
  /** Aviso legal obligatorio sobre la regla antiaplicación post-venta */
  postSaleWarning: string;
  headline: string;
}

export interface FifoEngineOptions {
  positions: PositionItem[];
  /** Brókers a incluir (por defecto ['DEGIRO']) */
  selectedBrokers?: string[];
  /** Año fiscal a auditar (por defecto año de referenceDate) */
  fiscalYear?: number;
  /** Criterio legal AEAT (Art. 37.2 LIRPF): consolidar valores homogéneos por ISIN (default: true) */
  consolidateByIsin?: boolean;
  /** Transacciones adicionales importadas vía CSV de DEGIRO u otros brókers */
  customTransactions?: CustomFifoTransaction[];
  /** Fecha de referencia para el cálculo de la regla de los 2 meses (default: hoy) */
  referenceDate?: Date;
}

export interface FifoEngineResult {
  fiscalYear: number;
  consolidateByIsin: boolean;
  selectedBrokers: string[];
  availableBrokers: string[];
  referenceDateIso: string;
  yearSummary: FifoYearSummary;
  allYearsSummary: Record<number, FifoYearSummary>;
  availableYears: number[];
  assets: FifoAssetSummary[];
  realizedEventsYear: FifoRealizedEvent[];
  totalOpenCostBasisEur: number;
  totalMarketValueEur: number;
  totalUnrealizedGainEur: number;
  totalUnrealizedLossEur: number;
  netUnrealizedEur: number;
  optimizationPlan: FifoRecommendationPlan;
}

// ============================================================================
// CONSTANTES FISCALES Y METADATOS DE RESPALDO DEGIRO
// ============================================================================

const EPSILON = 1e-8;

interface RawDegiroTx {
  d: string;
  t?: string;
  q: number;
  p: number;
  f: number;
  net: number;
}

interface RawDegiroAssetBucket {
  stats?: Record<string, unknown>;
  transactions: RawDegiroTx[];
}

const DEGIRO_TX_DATA = rawDegiroTransactions as Record<string, RawDegiroAssetBucket>;

interface KnownDegiroMeta {
  isin: string;
  name: string;
  ticker: string;
  exchange: string;
  assetType: AssetType;
}

const DEGIRO_KNOWN_METADATA: Record<string, KnownDegiroMeta> = {
  'pos-nvda-ndq': {
    isin: 'US67066G1040',
    name: 'NVIDIA Corporation',
    ticker: 'NVDA',
    exchange: 'NDQ',
    assetType: 'Acciones',
  },
  'pos-21shares-btc-xet': {
    isin: 'CH0454664001',
    name: '21Shares Bitcoin ETP',
    ticker: '2BTC',
    exchange: 'XET',
    assetType: 'Cripto',
  },
  'pos-vaneck-btc-tdg': {
    isin: 'DE000A28M8D0',
    name: 'VanEck Bitcoin ETN',
    ticker: 'VBTC',
    exchange: 'TDG',
    assetType: 'Cripto',
  },
  'pos-wt-gold-3x-mil': {
    isin: 'IE00B8HGT870',
    name: 'Wisdomtree Gold 3X Daily Leveraged',
    ticker: '3GOL',
    exchange: 'MIL',
    assetType: 'ETFs',
  },
  'pos-wt-gold-3x-tdg': {
    isin: 'IE00B8HGT870',
    name: 'Wisdomtree Gold 3X Daily Leveraged',
    ticker: '3GOL',
    exchange: 'TDG',
    assetType: 'ETFs',
  },
  'pos-wt-nasdaq-3x-mil': {
    isin: 'IE00BLRPRL42',
    name: 'Wisdomtree Nasdaq 100 3X Daily Leveraged',
    ticker: 'QQQ3',
    exchange: 'MIL',
    assetType: 'ETFs',
  },
  'pos-wt-nasdaq-3x-tdg': {
    isin: 'IE00BLRPRL42',
    name: 'Wisdomtree Nasdaq 100 3X Daily Leveraged',
    ticker: 'QQQ3',
    exchange: 'TDG',
    assetType: 'ETFs',
  },
};

/** Tramos vigentes de la Base Imponible del Ahorro IRPF España (Ley 35/2006 modificada por Ley 7/2024) */
const SPANISH_SAVINGS_TAX_BRACKETS: ReadonlyArray<{
  min: number;
  max: number;
  rate: number;
  label: string;
}> = [
  { min: 0, max: 6000, rate: 0.19, label: '0 € – 6.000 € (19%)' },
  { min: 6000, max: 50000, rate: 0.21, label: '6.000 € – 50.000 € (21%)' },
  { min: 50000, max: 200000, rate: 0.23, label: '50.000 € – 200.000 € (23%)' },
  { min: 200000, max: 300000, rate: 0.27, label: '200.000 € – 300.000 € (27%)' },
  { min: 300000, max: Infinity, rate: 0.30, label: 'Más de 300.000 € (30%)' },
];

// ============================================================================
// UTILIDADES NUMÉRICAS Y DE FECHAS
// ============================================================================

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeBrokerName(broker?: string): string {
  const cleaned = (broker || 'DEGIRO').trim();
  return cleaned.length > 0 ? cleaned : 'DEGIRO';
}

function brokerKey(broker: string): string {
  return normalizeBrokerName(broker).toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDateUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function parseFlexibleDate(
  dateStr: string,
  timeStr?: string
): { iso: string; year: number; timestamp: number; time: string } | null {
  const raw = (dateStr || '').trim();
  if (!raw) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  // YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    // DD-MM-YYYY o DD/MM/YYYY
    const euMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (euMatch) {
      day = Number(euMatch[1]);
      month = Number(euMatch[2]);
      year = Number(euMatch[3]);
    } else {
      return null;
    }
  }

  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hours = 0;
  let minutes = 0;
  const cleanTime = (timeStr || '00:00').trim();
  const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hours = Math.min(23, Math.max(0, Number(timeMatch[1])));
    minutes = Math.min(59, Math.max(0, Number(timeMatch[2])));
  }

  const timestamp = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  return { iso, year, timestamp, time: `${pad2(hours)}:${pad2(minutes)}` };
}

function isoToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function addCalendarMonthsUTC(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return `${targetYear}-${pad2(normalizedMonth + 1)}-${pad2(clampedDay)}`;
}

function addDaysUTC(iso: string, days: number): string {
  const dt = isoToUtcDate(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toIsoDateUTC(dt);
}

function diffDaysUTC(fromIso: string, toIso: string): number {
  const ms = isoToUtcDate(toIso).getTime() - isoToUtcDate(fromIso).getTime();
  return Math.round(ms / 86400000);
}

/**
 * Comprueba si buyIso está dentro de la ventana de 2 meses naturales anteriores o posteriores a sellIso
 * (Art. 33.5.f LIRPF y Art. 30.4 LPACAP: cómputo de fecha a fecha).
 */
function isWithinTwoMonthWindow(buyIso: string, sellIso: string): boolean {
  const windowStart = addCalendarMonthsUTC(sellIso, -2);
  const windowEnd = addCalendarMonthsUTC(sellIso, 2);
  return buyIso >= windowStart && buyIso <= windowEnd;
}

/**
 * Calcula la fecha exacta de desbloqueo tras una compra:
 * 2 meses naturales completos + 1 día (primer día libre sin infringir los 2 meses).
 * Ejemplo: compra 2026-10-22 -> plazo vence 2026-12-22 -> primer día libre 2026-12-23.
 */
function computeWashSaleUnlockDate(lastBuyIso: string): string {
  const twoMonthsLater = addCalendarMonthsUTC(lastBuyIso, 2);
  return addDaysUTC(twoMonthsLater, 1);
}

function formatEurEs(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${withDots},${decPart} €`;
}

// ============================================================================
// 1. CÁLCULO OFICIAL IRPF BASE DEL AHORRO ESPAÑA
// ============================================================================

export function calculateSpanishSavingsTax(netGainEur: number): SpanishSavingsTaxResult {
  if (!Number.isFinite(netGainEur) || netGainEur <= 0) {
    return {
      taxEur: 0,
      effectiveRate: 0,
      marginalRate: 0,
      breakdown: [],
    };
  }

  let totalTax = 0;
  let marginalRate = 0;
  const breakdown: SpanishTaxBracketDetail[] = [];

  for (const b of SPANISH_SAVINGS_TAX_BRACKETS) {
    if (netGainEur <= b.min) break;
    const upper = Math.min(netGainEur, b.max);
    const taxable = Math.max(0, upper - b.min);
    if (taxable > 0) {
      const tax = taxable * b.rate;
      totalTax += tax;
      marginalRate = b.rate;
      breakdown.push({
        bracket: b.label,
        taxable: round2(taxable),
        rate: b.rate,
        tax: round2(tax),
      });
    }
  }

  const taxEur = round2(totalTax);
  const effectiveRate = netGainEur > 0 ? round4(taxEur / netGainEur) : 0;

  return {
    taxEur,
    effectiveRate,
    marginalRate,
    breakdown,
  };
}

// ============================================================================
// 2. EVALUACIÓN REGLA ANTIAPLICACIÓN 2 MESES (ART. 33.5.f LIRPF)
// ============================================================================

function assessWashSaleForFutureLoss(
  allBuyEvents: Array<{ dateIso: string; qty: number }>,
  referenceDateIso: string,
  fiscalYear: number
): WashSaleAssessment {
  if (allBuyEvents.length === 0) {
    return {
      status: 'libre',
      lastBuyDate: null,
      unlockDate: null,
      daysUntilUnlock: 0,
      unlocksBeforeYearEnd: true,
      windowDaysBeforeYearEnd: Math.max(0, diffDaysUTC(referenceDateIso, `${fiscalYear}-12-31`) + 1),
      canBypassWithFullLiquidation: true,
      recentBuysQty: 0,
      summary: 'Libre de bloqueo por compras previas. Si vendes con pérdida, evita recomprar el mismo ISIN durante los 2 meses posteriores.',
    };
  }

  const sortedBuys = [...allBuyEvents].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  const lastBuyDate = sortedBuys[sortedBuys.length - 1].dateIso;
  const unlockDate = computeWashSaleUnlockDate(lastBuyDate);
  const yearEndIso = `${fiscalYear}-12-31`;

  const twoMonthsAgoIso = addCalendarMonthsUTC(referenceDateIso, -2);
  const recentBuysQty = round4(
    sortedBuys
      .filter((b) => b.dateIso >= twoMonthsAgoIso && b.dateIso <= referenceDateIso)
      .reduce((acc, b) => acc + b.qty, 0)
  );

  if (referenceDateIso >= unlockDate) {
    const remainingYearDays = Math.max(0, diffDaysUTC(referenceDateIso, yearEndIso) + 1);
    return {
      status: 'libre',
      lastBuyDate,
      unlockDate,
      daysUntilUnlock: 0,
      unlocksBeforeYearEnd: true,
      windowDaysBeforeYearEnd: remainingYearDays,
      canBypassWithFullLiquidation: true,
      recentBuysQty: 0,
      summary: `Libre hoy (última compra el ${lastBuyDate}, hace más de 2 meses). No recompres el mismo ISIN en los 2 meses posteriores a la venta.`,
    };
  }

  const daysUntilUnlock = Math.max(1, diffDaysUTC(referenceDateIso, unlockDate));
  const unlocksBeforeYearEnd = unlockDate <= yearEndIso;

  if (unlocksBeforeYearEnd) {
    const windowDaysBeforeYearEnd = Math.max(1, diffDaysUTC(unlockDate, yearEndIso) + 1);
    return {
      status: 'bloqueada_ventana_anio',
      lastBuyDate,
      unlockDate,
      daysUntilUnlock,
      unlocksBeforeYearEnd: true,
      windowDaysBeforeYearEnd,
      canBypassWithFullLiquidation: true,
      recentBuysQty,
      summary: `Bloqueada hoy por compra reciente (${lastBuyDate}). Se desbloquea el ${unlockDate} (${windowDaysBeforeYearEnd} días de ventana libre antes del 31/12/${fiscalYear}), o vendiendo hoy el 100% del ISIN sin recomprar en 2 meses.`,
    };
  }

  return {
    status: 'bloqueada_fuera_anio',
    lastBuyDate,
    unlockDate,
    daysUntilUnlock,
    unlocksBeforeYearEnd: false,
    windowDaysBeforeYearEnd: 0,
    canBypassWithFullLiquidation: true,
    recentBuysQty,
    summary: `Bloqueada hasta el ${unlockDate} (fuera del ejercicio ${fiscalYear}) por compra el ${lastBuyDate}. Para imputar la pérdida en ${fiscalYear} debes liquidar el 100% del ISIN y no recomprar en 2 meses.`,
  };
}

// ============================================================================
// 3. MOTOR PRINCIPAL FIFO (CONSOLIDADO POR ISIN O POR POSICIÓN/BOLSA)
// ============================================================================

interface InternalTx {
  id: string;
  groupKey: string;
  isin: string;
  name: string;
  ticker: string;
  assetType: AssetType;
  broker: string;
  exchange: string;
  positionId: string;
  dateIso: string;
  time: string;
  year: number;
  timestamp: number;
  /** Orden cronológico original para desempatar transacciones en el mismo minuto */
  chronoTieBreaker: number;
  quantity: number;
  price: number;
  feesEur: number;
  netEur: number;
  isEstimated: boolean;
}

function buildYearSummary(
  fiscalYear: number,
  events: FifoRealizedEvent[],
  feesYearEur: number
): FifoYearSummary {
  let gains = 0;
  let losses = 0;
  let deferredLosses = 0;

  for (const ev of events) {
    if (ev.gainLossEur >= 0) {
      gains += ev.gainLossEur;
    } else {
      losses += ev.gainLossEur;
      if (ev.deferredLossEur > 0) {
        deferredLosses += ev.deferredLossEur;
      }
    }
  }

  const realizedGainsEur = round2(gains);
  const realizedLossesEur = round2(losses);
  const realizedNetEur = round2(gains + losses);
  const deferredLossesEur = round2(deferredLosses);
  const computableNetEur = round2(realizedNetEur + deferredLossesEur);

  return {
    fiscalYear,
    salesCount: events.length,
    realizedGainsEur,
    realizedLossesEur,
    realizedNetEur,
    deferredLossesEur,
    computableNetEur,
    feesYearEur: round2(feesYearEur),
    taxEstimate: calculateSpanishSavingsTax(computableNetEur),
    taxEstimateWithoutDeferral: calculateSpanishSavingsTax(realizedNetEur),
  };
}

export function runFifoTaxEngine(options: FifoEngineOptions): FifoEngineResult {
  const referenceDate = options.referenceDate ?? new Date();
  const referenceDateIso = toIsoDateUTC(referenceDate);
  const fiscalYear = options.fiscalYear ?? referenceDate.getUTCFullYear();
  const consolidateByIsin = options.consolidateByIsin ?? true;
  const customTransactions = options.customTransactions ?? [];

  const positions = Array.isArray(options.positions) ? options.positions : [];

  // 1. Descubrir brókers disponibles en posiciones + transacciones DEGIRO + customTransactions
  const brokerMap = new Map<string, string>();
  brokerMap.set('DEGIRO', 'DEGIRO');

  for (const pos of positions) {
    if (!pos) continue;
    const b = normalizeBrokerName(pos.broker);
    brokerMap.set(brokerKey(b), b);
  }
  for (const tx of customTransactions) {
    if (!tx || typeof tx !== 'object') continue;
    const b = normalizeBrokerName(tx.broker);
    brokerMap.set(brokerKey(b), b);
  }

  const availableBrokers = Array.from(brokerMap.values());
  const selectedBrokersRaw =
    options.selectedBrokers && options.selectedBrokers.length > 0
      ? options.selectedBrokers
      : ['DEGIRO'];
  const selectedBrokerKeys = new Set(selectedBrokersRaw.map(brokerKey));
  const selectedBrokers = Array.from(selectedBrokerKeys).map(
    (k) => brokerMap.get(k) ?? k
  );

  // Mapa rápido de posiciones por id y por ISIN
  const positionById = new Map<string, PositionItem>();
  const positionsByIsin = new Map<string, PositionItem[]>();
  for (const pos of positions) {
    if (!pos) continue;
    positionById.set(pos.id, pos);
    const isin = (pos.isin || pos.ticker || pos.id || '').trim().toUpperCase();
    if (!isin) continue;
    const list = positionsByIsin.get(isin) ?? [];
    list.push(pos);
    positionsByIsin.set(isin, list);
  }

  // 2. Recopilar todas las transacciones normalizadas de los brókers seleccionados
  const internalTxs: InternalTx[] = [];
  const handledPositionIds = new Set<string>();
  const handledIsinsByBroker = new Set<string>();
  let globalCounter = 0;

  // 2a. Transacciones reales de DEGIRO embebidas en degiroAssetTransactions.json
  if (selectedBrokerKeys.has('DEGIRO')) {
    for (const [posId, bucket] of Object.entries(DEGIRO_TX_DATA)) {
      const pos = positionById.get(posId);
      const fallback = DEGIRO_KNOWN_METADATA[posId];
      const isin = (pos?.isin || fallback?.isin || posId).trim().toUpperCase();
      const name = pos?.name || fallback?.name || posId;
      const ticker = pos?.ticker || fallback?.ticker || isin;
      const exchange = pos?.exchange || fallback?.exchange || 'EUR';
      const assetType: AssetType = pos?.type || fallback?.assetType || 'ETFs';
      const broker = normalizeBrokerName(pos?.broker || 'DEGIRO');

      if (!selectedBrokerKeys.has(brokerKey(broker))) continue;

      handledPositionIds.add(posId);
      handledIsinsByBroker.add(`${brokerKey(broker)}::${isin}`);

      const txs = bucket.transactions || [];
      const totalLen = txs.length;
      txs.forEach((tx, idx) => {
        const parsed = parseFlexibleDate(tx.d, tx.t);
        if (!parsed || !Number.isFinite(tx.q) || Math.abs(tx.q) < EPSILON) return;
        const groupKey = consolidateByIsin ? isin : posId;
        internalTxs.push({
          id: `degiro-${posId}-${idx}`,
          groupKey,
          isin,
          name,
          ticker,
          assetType,
          broker,
          exchange,
          positionId: posId,
          dateIso: parsed.iso,
          time: parsed.time,
          year: parsed.year,
          timestamp: parsed.timestamp,
          // El JSON de DEGIRO viene en orden cronológico inverso (más reciente primero)
          chronoTieBreaker: totalLen - 1 - idx,
          quantity: tx.q,
          price: Number.isFinite(tx.p) ? tx.p : 0,
          feesEur: Number.isFinite(tx.f) ? Math.abs(tx.f) : 0,
          netEur: Number.isFinite(tx.net) ? tx.net : 0,
          isEstimated: false,
        });
      });
    }
  }

  // 2b. Transacciones personalizadas importadas vía CSV
  customTransactions.forEach((tx, idx) => {
    if (!tx || typeof tx !== 'object') return;
    const broker = normalizeBrokerName(tx.broker);
    if (!selectedBrokerKeys.has(brokerKey(broker))) return;
    const parsed = parseFlexibleDate(tx.date, tx.time);
    if (!parsed || !Number.isFinite(tx.quantity) || Math.abs(tx.quantity) < EPSILON) return;

    const isin = (tx.isin || tx.ticker || tx.name || '').trim().toUpperCase();
    if (!isin) return;
    const posId = tx.positionId || `custom-${brokerKey(broker)}-${isin}-${tx.exchange || 'GEN'}`;
    const matchedPos = positionById.get(posId) ?? positionsByIsin.get(isin)?.[0];
    const groupKey = consolidateByIsin ? isin : posId;

    if (matchedPos) handledPositionIds.add(matchedPos.id);
    handledIsinsByBroker.add(`${brokerKey(broker)}::${isin}`);

    // Si netEur no está bien informado, derivarlo de quantity, price y feesEur
    const fees = Number.isFinite(tx.feesEur) ? Math.abs(tx.feesEur) : 0;
    const safePrice = Number.isFinite(tx.price) ? Math.abs(tx.price) : 0;
    let netEur = tx.netEur;
    if (!Number.isFinite(netEur) || netEur === 0) {
      const gross = Math.abs(tx.quantity) * safePrice;
      netEur = tx.quantity > 0 ? -(gross + fees) : Math.max(0, gross - fees);
    }

    internalTxs.push({
      id: tx.id || `custom-${++globalCounter}-${idx}`,
      groupKey,
      isin,
      name: tx.name || matchedPos?.name || isin,
      ticker: tx.ticker || matchedPos?.ticker || isin,
      assetType: tx.assetType || matchedPos?.type || 'Acciones',
      broker,
      exchange: tx.exchange || matchedPos?.exchange || broker,
      positionId: posId,
      dateIso: parsed.iso,
      time: parsed.time,
      year: parsed.year,
      timestamp: parsed.timestamp,
      chronoTieBreaker: 100000 + idx,
      quantity: tx.quantity,
      price: safePrice,
      feesEur: fees,
      netEur,
      isEstimated: false,
    });
  });

  // 2c. Posiciones abiertas de otros brókers (MyInvestor, Kraken, BBVA, etc.) sin historial granular
  for (const pos of positions) {
    if (!pos || pos.status === 'Cerrada' || !Number.isFinite(pos.shares) || pos.shares <= EPSILON) continue;
    const broker = normalizeBrokerName(pos.broker);
    if (!selectedBrokerKeys.has(brokerKey(broker))) continue;

    const isin = (pos.isin || pos.ticker || pos.id || '').trim().toUpperCase();
    if (!isin) continue;
    if (handledPositionIds.has(pos.id)) continue;
    if (handledIsinsByBroker.has(`${brokerKey(broker)}::${isin}`)) continue;

    const parsed =
      parseFlexibleDate(pos.purchaseDate || `${fiscalYear - 1}-01-01`, '09:00') ??
      parseFlexibleDate('2024-01-01', '09:00')!;
    const groupKey = consolidateByIsin ? isin : pos.id;
    const safeAvgPrice = Number.isFinite(pos.avgPrice) && pos.avgPrice >= 0 ? pos.avgPrice : 0;
    const costEur = pos.shares * safeAvgPrice;

    internalTxs.push({
      id: `synthetic-${pos.id}`,
      groupKey,
      isin,
      name: pos.name,
      ticker: pos.ticker,
      assetType: pos.type,
      broker,
      exchange: pos.exchange || broker,
      positionId: pos.id,
      dateIso: parsed.iso,
      time: parsed.time,
      year: parsed.year,
      timestamp: parsed.timestamp,
      chronoTieBreaker: ++globalCounter,
      quantity: pos.shares,
      price: safeAvgPrice,
      feesEur: 0,
      netEur: -costEur,
      isEstimated: true,
    });
  }

  // 3. Agrupar por groupKey (ISIN o positionId) y ejecutar FIFO estricto
  const groupedTxs = new Map<string, InternalTx[]>();
  for (const tx of internalTxs) {
    const list = groupedTxs.get(tx.groupKey) ?? [];
    list.push(tx);
    groupedTxs.set(tx.groupKey, list);
  }

  const assets: FifoAssetSummary[] = [];
  const allRealizedEvents: FifoRealizedEvent[] = [];
  const feesByYear = new Map<number, number>();
  const eventsByYear = new Map<number, FifoRealizedEvent[]>();

  for (const [groupKey, txs] of groupedTxs.entries()) {
    // Orden cronológico estricto ascendente
    txs.sort((a, b) => a.timestamp - b.timestamp || a.chronoTieBreaker - b.chronoTieBreaker);

    const openLots: FifoLot[] = [];
    const groupRealizedEvents: FifoRealizedEvent[] = [];
    const allBuyRecords: Array<{ dateIso: string; qty: number }> = [];
    const brokerSet = new Set<string>();
    const exchangeSet = new Set<string>();
    const positionIdSet = new Set<string>();
    let hasGranularHistory = false;
    let feesYearForAsset = 0;

    let sampleName = txs[0].name;
    let sampleTicker = txs[0].ticker;
    let sampleIsin = txs[0].isin;
    let sampleAssetType = txs[0].assetType;

    let lotSeq = 0;
    let eventSeq = 0;

    for (const tx of txs) {
      brokerSet.add(tx.broker);
      exchangeSet.add(tx.exchange);
      positionIdSet.add(tx.positionId);
      if (!tx.isEstimated) hasGranularHistory = true;

      if (tx.feesEur > 0) {
        feesByYear.set(tx.year, (feesByYear.get(tx.year) ?? 0) + tx.feesEur);
        if (tx.year === fiscalYear) {
          feesYearForAsset += tx.feesEur;
        }
      }

      if (tx.quantity > 0) {
        const totalCostEur = Math.abs(tx.netEur);
        const unitCostEur = totalCostEur / tx.quantity;
        openLots.push({
          lotId: `${groupKey}-L${++lotSeq}`,
          buyDate: tx.dateIso,
          buyTime: tx.time,
          buyTimestamp: tx.timestamp,
          originalQty: tx.quantity,
          remainingQty: tx.quantity,
          unitCostEur,
          remainingCostEur: totalCostEur,
          remainingFeesEur: tx.feesEur,
          broker: tx.broker,
          exchange: tx.exchange,
          positionId: tx.positionId,
          isEstimated: tx.isEstimated,
        });
        allBuyRecords.push({ dateIso: tx.dateIso, qty: tx.quantity });
      } else if (tx.quantity < 0) {
        const qtyToSell = Math.abs(tx.quantity);
        let remainingToSell = qtyToSell;
        const totalProceedsEur = tx.netEur;
        const unitProceedsEur = totalProceedsEur / qtyToSell;
        let totalCostBasisEur = 0;
        const consumedLots: FifoConsumedLotDetail[] = [];

        while (remainingToSell > EPSILON && openLots.length > 0) {
          const lot = openLots[0];
          const take = Math.min(remainingToSell, lot.remainingQty);
          const costPart = take * lot.unitCostEur;
          const proceedsPart = take * unitProceedsEur;
          const gainPart = proceedsPart - costPart;

          totalCostBasisEur += costPart;
          consumedLots.push({
            lotId: lot.lotId,
            buyDate: lot.buyDate,
            qtyConsumed: round4(take),
            unitCostEur: round4(lot.unitCostEur),
            costBasisEur: round2(costPart),
            proceedsEur: round2(proceedsPart),
            gainLossEur: round2(gainPart),
            holdingDays: Math.max(0, diffDaysUTC(lot.buyDate, tx.dateIso)),
          });

          const prevRatio = lot.remainingQty > EPSILON ? (lot.remainingQty - take) / lot.remainingQty : 0;
          lot.remainingQty -= take;
          lot.remainingCostEur = Math.max(0, lot.remainingQty * lot.unitCostEur);
          lot.remainingFeesEur = Math.max(0, lot.remainingFeesEur * prevRatio);
          remainingToSell -= take;

          if (lot.remainingQty <= EPSILON) {
            openLots.shift();
          }
        }

        const gainLossEur = totalProceedsEur - totalCostBasisEur;

        const ev: FifoRealizedEvent = {
          eventId: `${groupKey}-S${++eventSeq}`,
          groupKey,
          isin: tx.isin,
          name: tx.name,
          ticker: tx.ticker,
          broker: tx.broker,
          exchange: tx.exchange,
          positionId: tx.positionId,
          sellDate: tx.dateIso,
          sellTime: tx.time,
          fiscalYear: tx.year,
          qtySold: round4(qtyToSell),
          unitProceedsEur: round4(unitProceedsEur),
          totalProceedsEur: round2(totalProceedsEur),
          costBasisEur: round2(totalCostBasisEur),
          sellFeesEur: round2(tx.feesEur),
          // Guardamos el valor exacto sin truncado previo para el sumatorio anual y redondeado a 2 dec.
          gainLossEur,
          consumedLots,
          washSaleDeferred: false,
          deferredLossEur: 0,
          blockedQty: 0,
        };
        groupRealizedEvents.push(ev);
      }
    }

    // 4. Evaluar regla antiaplicación de 2 meses en ventas con pérdida ya cerradas en el año fiscal
    // Un título en openLots cuya fecha de compra esté en [sellDate - 2m, sellDate + 2m] bloquea
    // proporcionalmente la pérdida de esa venta hasta que dicho título sea vendido.
    const availableBlockingLots = openLots.map((l) => ({
      buyDate: l.buyDate,
      availableQty: l.remainingQty,
    }));

    for (const ev of groupRealizedEvents) {
      if (ev.fiscalYear !== fiscalYear || ev.gainLossEur >= -EPSILON) continue;

      let blockedForThisSale = 0;
      let neededToBlock = ev.qtySold;

      for (const bl of availableBlockingLots) {
        if (neededToBlock <= EPSILON) break;
        if (bl.availableQty <= EPSILON) continue;
        if (isWithinTwoMonthWindow(bl.buyDate, ev.sellDate)) {
          const take = Math.min(neededToBlock, bl.availableQty);
          blockedForThisSale += take;
          bl.availableQty -= take;
          neededToBlock -= take;
        }
      }

      if (blockedForThisSale > EPSILON && ev.qtySold > EPSILON) {
        const ratio = Math.min(1, blockedForThisSale / ev.qtySold);
        const deferred = Math.abs(ev.gainLossEur) * ratio;
        ev.washSaleDeferred = true;
        ev.blockedQty = round4(blockedForThisSale);
        ev.deferredLossEur = round2(deferred);
        ev.washSaleReason = `Regla 2 meses (Art. 33.5.f LIRPF): ${round4(blockedForThisSale)} de ${ev.qtySold} títulos recomprados en la ventana ±2 meses siguen abiertos en cartera.`;
      }
    }

    // Registrar eventos por año
    for (const ev of groupRealizedEvents) {
      const yearList = eventsByYear.get(ev.fiscalYear) ?? [];
      yearList.push(ev);
      eventsByYear.set(ev.fiscalYear, yearList);
      allRealizedEvents.push(ev);
    }

    // 5. Calcular precio de mercado actual ponderado si el ISIN agrupa varias bolsas
    const matchedPositions = Array.from(positionIdSet)
      .map((id) => positionById.get(id))
      .filter((p): p is PositionItem => Boolean(p));

    if (matchedPositions.length > 0) {
      sampleName = matchedPositions[0].name || sampleName;
      sampleAssetType = matchedPositions[0].type || sampleAssetType;
      sampleIsin = (matchedPositions[0].isin || sampleIsin).toUpperCase();
      const rawTicker = matchedPositions[0].ticker || sampleTicker;
      sampleTicker =
        consolidateByIsin && matchedPositions.length > 1
          ? rawTicker.replace(/\s*\(.*?\)\s*/g, '').trim()
          : rawTicker;
    }

    const openQtyRaw = openLots.reduce((sum, l) => sum + l.remainingQty, 0);
    const openQty = round4(openQtyRaw);
    const openCostBasisRaw = openLots.reduce((sum, l) => sum + l.remainingQty * l.unitCostEur, 0);
    const openCostBasisEur = round2(openCostBasisRaw);
    const fifoAvgCostEur = openQtyRaw > EPSILON ? round4(openCostBasisRaw / openQtyRaw) : 0;

    let currentPriceEur = 0;
    let marketValueEur = 0;
    if (openQtyRaw > EPSILON) {
      if (matchedPositions.length > 0) {
        const totalPosShares = matchedPositions.reduce(
          (s, p) => s + (Number.isFinite(p.shares) ? Math.max(0, p.shares) : 0),
          0
        );
        if (totalPosShares > EPSILON) {
          const weightedValue = matchedPositions.reduce((s, p) => {
            const safeShares = Number.isFinite(p.shares) ? Math.max(0, p.shares) : 0;
            const safeCurr = Number.isFinite(p.currentPrice) && p.currentPrice >= 0 ? p.currentPrice : 0;
            return s + safeShares * safeCurr;
          }, 0);
          currentPriceEur = round4(weightedValue / totalPosShares);
          marketValueEur = round2(openQtyRaw * currentPriceEur);
        } else {
          const safeCurr =
            Number.isFinite(matchedPositions[0].currentPrice) && matchedPositions[0].currentPrice >= 0
              ? matchedPositions[0].currentPrice
              : 0;
          currentPriceEur = round4(safeCurr);
          marketValueEur = round2(openQtyRaw * currentPriceEur);
        }
      } else {
        // Sin posición en vivo: usar último precio de transacción
        const lastTx = txs[txs.length - 1];
        currentPriceEur =
          Math.abs(lastTx.quantity) > EPSILON
            ? round4(Math.abs(lastTx.netEur / lastTx.quantity))
            : 0;
        marketValueEur = round2(openQtyRaw * currentPriceEur);
      }
    }

    const unrealizedGainLossEur = round2(marketValueEur - openCostBasisRaw);
    const unrealizedGainLossPct =
      openCostBasisRaw > EPSILON ? round2((unrealizedGainLossEur / openCostBasisRaw) * 100) : 0;

    // Métricas realizadas del año fiscal para este activo
    const realizedEventsYear = groupRealizedEvents.filter((e) => e.fiscalYear === fiscalYear);
    let gainsYear = 0;
    let lossesYear = 0;
    let deferredYear = 0;
    for (const e of realizedEventsYear) {
      if (e.gainLossEur >= 0) gainsYear += e.gainLossEur;
      else lossesYear += e.gainLossEur;
      deferredYear += e.deferredLossEur;
    }

    // Normalizar gainLossEur a 2 decimales para la salida limpia por evento (después de sumar exacto)
    const normalizedRealizedYear = realizedEventsYear.map((e) => ({
      ...e,
      gainLossEur: round2(e.gainLossEur),
    }));
    const normalizedAllRealized = groupRealizedEvents.map((e) => ({
      ...e,
      gainLossEur: round2(e.gainLossEur),
    }));

    const washSale = assessWashSaleForFutureLoss(allBuyRecords, referenceDateIso, fiscalYear);

    const normalizedOpenLots: FifoLot[] = openLots.map((l) => ({
      ...l,
      remainingQty: round4(l.remainingQty),
      unitCostEur: round4(l.unitCostEur),
      remainingCostEur: round2(l.remainingQty * l.unitCostEur),
      remainingFeesEur: round2(l.remainingFeesEur),
    }));

    assets.push({
      groupKey,
      isin: sampleIsin,
      name: sampleName,
      ticker: sampleTicker,
      assetType: sampleAssetType,
      brokers: Array.from(brokerSet),
      exchanges: Array.from(exchangeSet),
      positionIds: Array.from(positionIdSet),
      hasGranularHistory,
      openQty,
      openCostBasisEur,
      fifoAvgCostEur,
      currentPriceEur,
      marketValueEur,
      unrealizedGainLossEur,
      unrealizedGainLossPct,
      openLots: normalizedOpenLots,
      realizedGainsYearEur: round2(gainsYear),
      realizedLossesYearEur: round2(lossesYear),
      realizedNetYearEur: round2(gainsYear + lossesYear),
      deferredLossesYearEur: round2(deferredYear),
      computableNetYearEur: round2(gainsYear + lossesYear + deferredYear),
      realizedEventsYear: normalizedRealizedYear,
      allRealizedEvents: normalizedAllRealized,
      feesYearEur: round2(feesYearForAsset),
      washSale,
    });
  }

  // Ordenar activos: primero mayor valor de mercado, luego nombre
  assets.sort((a, b) => b.marketValueEur - a.marketValueEur || a.name.localeCompare(b.name));

  // 6. Construir resúmenes anuales
  const allYearKeys = new Set<number>([fiscalYear]);
  for (const y of eventsByYear.keys()) allYearKeys.add(y);
  for (const y of feesByYear.keys()) allYearKeys.add(y);

  const availableYears = Array.from(allYearKeys).sort((a, b) => b - a);
  const allYearsSummary: Record<number, FifoYearSummary> = {};
  for (const y of availableYears) {
    allYearsSummary[y] = buildYearSummary(y, eventsByYear.get(y) ?? [], feesByYear.get(y) ?? 0);
  }

  const yearSummary = allYearsSummary[fiscalYear];
  const realizedEventsYear = (eventsByYear.get(fiscalYear) ?? [])
    .map((e) => ({ ...e, gainLossEur: round2(e.gainLossEur) }))
    .sort((a, b) => b.sellDate.localeCompare(a.sellDate) || b.sellTime.localeCompare(a.sellTime));

  const totalOpenCostBasisEur = round2(assets.reduce((s, a) => s + a.openCostBasisEur, 0));
  const totalMarketValueEur = round2(assets.reduce((s, a) => s + a.marketValueEur, 0));
  const totalUnrealizedGainEur = round2(
    assets.reduce((s, a) => s + (a.unrealizedGainLossEur > 0 ? a.unrealizedGainLossEur : 0), 0)
  );
  const totalUnrealizedLossEur = round2(
    assets.reduce((s, a) => s + (a.unrealizedGainLossEur < 0 ? a.unrealizedGainLossEur : 0), 0)
  );
  const netUnrealizedEur = round2(totalMarketValueEur - totalOpenCostBasisEur);

  const partialResult: FifoEngineResult = {
    fiscalYear,
    consolidateByIsin,
    selectedBrokers,
    availableBrokers,
    referenceDateIso,
    yearSummary,
    allYearsSummary,
    availableYears,
    assets,
    realizedEventsYear,
    totalOpenCostBasisEur,
    totalMarketValueEur,
    totalUnrealizedGainEur,
    totalUnrealizedLossEur,
    netUnrealizedEur,
    optimizationPlan: {} as FifoRecommendationPlan,
  };

  partialResult.optimizationPlan = generateTaxOptimizationPlan(partialResult, 0, 0);
  return partialResult;
}

// ============================================================================
// 4. SIMULADOR DE VENTA FIFO LOTE A LOTE
// ============================================================================

export function simulateFifoSale(
  assetSummary: FifoAssetSummary,
  qtyToSell: number,
  customPriceEur?: number,
  referenceDate?: Date,
  currentYearNetGainEur = 0,
  fiscalYear?: number
): FifoSaleSimulationResult {
  const refDate = referenceDate ?? new Date();
  const refIso = toIsoDateUTC(refDate);
  const targetYear = fiscalYear ?? refDate.getUTCFullYear();

  const pricePerShareEur =
    customPriceEur !== undefined && Number.isFinite(customPriceEur) && customPriceEur >= 0
      ? customPriceEur
      : assetSummary.currentPriceEur;

  const safeRequested = Number.isFinite(qtyToSell) && qtyToSell > 0 ? qtyToSell : 0;
  const qtySimulated = Math.min(safeRequested, assetSummary.openQty);
  const isFullLiquidation =
    assetSummary.openQty > EPSILON && Math.abs(assetSummary.openQty - qtySimulated) <= 1e-6;

  let remaining = qtySimulated;
  let totalCostBasis = 0;
  const consumedLots: FifoConsumedLotDetail[] = [];

  for (const lot of assetSummary.openLots) {
    if (remaining <= EPSILON) break;
    const take = Math.min(remaining, lot.remainingQty);
    const costPart = take * lot.unitCostEur;
    const proceedsPart = take * pricePerShareEur;
    const gainPart = proceedsPart - costPart;

    totalCostBasis += costPart;
    consumedLots.push({
      lotId: lot.lotId,
      buyDate: lot.buyDate,
      qtyConsumed: round4(take),
      unitCostEur: round4(lot.unitCostEur),
      costBasisEur: round2(costPart),
      proceedsEur: round2(proceedsPart),
      gainLossEur: round2(gainPart),
      holdingDays: Math.max(0, diffDaysUTC(lot.buyDate, refIso)),
    });

    remaining -= take;
  }

  const estimatedProceedsEur = round2(qtySimulated * pricePerShareEur);
  const costBasisEur = round2(totalCostBasis);
  const gainLossEur = round2(estimatedProceedsEur - costBasisEur);
  const remainingQtyAfterSale = round4(Math.max(0, assetSummary.openQty - qtySimulated));

  // Evaluación de la regla de los 2 meses para esta venta simulada
  let washSaleEffectiveStatus: WashSaleStatus = assetSummary.washSale.status;
  let washSaleBlocked = false;
  let washSaleNote = '';

  if (gainLossEur >= 0) {
    washSaleEffectiveStatus = 'libre';
    washSaleBlocked = false;
    washSaleNote =
      'Esta operación genera plusvalía fiscal: la regla antiaplicación de los 2 meses solo aplica a ventas con pérdida.';
  } else if (isFullLiquidation) {
    washSaleEffectiveStatus = 'libre';
    washSaleBlocked = false;
    washSaleNote =
      'Liquidación total (100% del ISIN): la pérdida es 100% compensable en el ejercicio siempre que NO recompres el mismo ISIN durante los 2 meses posteriores.';
  } else if (assetSummary.washSale.status === 'libre') {
    washSaleBlocked = false;
    washSaleNote =
      'Operación libre de bloqueo por compras previas. Recuerda no recomprar este ISIN durante los 2 meses posteriores.';
  } else if (assetSummary.washSale.status === 'bloqueada_ventana_anio') {
    washSaleBlocked = true;
    washSaleNote = `Venta parcial bloqueada hoy por compra reciente (${assetSummary.washSale.lastBuyDate}). Espera al ${assetSummary.washSale.unlockDate} (ventana libre antes del 31/12/${targetYear}) o vende el 100% (${assetSummary.openQty} títulos).`;
  } else {
    washSaleBlocked = true;
    washSaleNote = `Venta parcial bloqueada hasta ${assetSummary.washSale.unlockDate} (fuera de ${targetYear}). Para compensar la pérdida este año debes liquidar el 100% (${assetSummary.openQty} títulos) sin recomprar en 2 meses.`;
  }

  // Impacto fiscal sobre IRPF anual
  const effectiveGainLossForTax = washSaleBlocked ? 0 : gainLossEur;
  const netBeforeEur = round2(currentYearNetGainEur);
  const netAfterEur = round2(currentYearNetGainEur + effectiveGainLossForTax);
  const taxBeforeEur = calculateSpanishSavingsTax(netBeforeEur).taxEur;
  const taxAfterEur = calculateSpanishSavingsTax(netAfterEur).taxEur;
  const taxDeltaEur = round2(taxBeforeEur - taxAfterEur);

  return {
    groupKey: assetSummary.groupKey,
    isin: assetSummary.isin,
    name: assetSummary.name,
    ticker: assetSummary.ticker,
    qtyRequested: round4(safeRequested),
    qtySimulated: round4(qtySimulated),
    isFullLiquidation,
    pricePerShareEur: round4(pricePerShareEur),
    estimatedProceedsEur,
    costBasisEur,
    gainLossEur,
    consumedLots,
    remainingQtyAfterSale,
    washSaleEffectiveStatus,
    washSaleBlocked,
    washSaleNote,
    taxImpact: {
      netBeforeEur,
      netAfterEur,
      taxBeforeEur,
      taxAfterEur,
      taxDeltaEur,
    },
  };
}

// ============================================================================
// 5. PLANIFICADOR INTELIGENTE "CERO IMPUESTOS" Y OPTIMIZACIÓN DE LIQUIDEZ
// ============================================================================

/**
 * Calcula cuántos títulos (enteros si el activo opera en enteros, o fraccionales si tiene decimales)
 * conviene vender por FIFO de un activo en pérdida para generar al menos `targetLossEur` (> 0).
 */
function findOptimalLossSaleQty(asset: FifoAssetSummary, targetLossEur: number): number {
  if (asset.openQty <= EPSILON || targetLossEur <= EPSILON) return 0;
  const isFractional = Math.abs(asset.openQty - Math.round(asset.openQty)) > 1e-4;

  let accQty = 0;
  let accLoss = 0;
  const price = asset.currentPriceEur;

  for (const lot of asset.openLots) {
    const unitPnL = price - lot.unitCostEur;
    const lotPnL = lot.remainingQty * unitPnL;

    if (unitPnL >= 0) {
      // Si el primer lote tiene ganancia pero los siguientes tienen gran pérdida, seguimos solo si compensa
      accQty += lot.remainingQty;
      accLoss -= lotPnL; // reduce la pérdida acumulada
      continue;
    }

    const lossPerUnit = Math.abs(unitPnL);
    if (lossPerUnit <= EPSILON) continue;
    const remainingNeeded = targetLossEur - accLoss;
    if (remainingNeeded <= EPSILON) break;

    const maxLossFromLot = lot.remainingQty * lossPerUnit;
    if (maxLossFromLot >= remainingNeeded) {
      const exactNeeded = remainingNeeded / lossPerUnit;
      const qtyFromLot = isFractional ? exactNeeded : Math.ceil(exactNeeded - EPSILON);
      accQty += Math.min(lot.remainingQty, qtyFromLot);
      accLoss += Math.min(lot.remainingQty, qtyFromLot) * lossPerUnit;
      break;
    } else {
      accQty += lot.remainingQty;
      accLoss += maxLossFromLot;
    }
  }

  if (accLoss <= EPSILON) return 0;
  const finalQty = Math.min(asset.openQty, isFractional ? round4(accQty) : Math.ceil(accQty - EPSILON));
  return finalQty;
}

export function generateTaxOptimizationPlan(
  engineResult: FifoEngineResult,
  targetExtraGainEur = 0,
  targetCashEur = 0
): FifoRecommendationPlan {
  const fiscalYear = engineResult.fiscalYear;
  const refDate = isoToUtcDate(engineResult.referenceDateIso);
  const extraGain = Number.isFinite(targetExtraGainEur) ? targetExtraGainEur : 0;
  const desiredCash = Number.isFinite(targetCashEur) && targetCashEur > 0 ? targetCashEur : 0;
  const mode: 'zero_tax' | 'target_cash' = desiredCash > 0 ? 'target_cash' : 'zero_tax';

  const currentRealizedNetEur = engineResult.yearSummary.realizedNetEur;
  const currentComputableNetEur = engineResult.yearSummary.computableNetEur;
  const baseNetForPlan = round2(currentComputableNetEur + extraGain);
  const taxBeforePlanEur = calculateSpanishSavingsTax(baseNetForPlan).taxEur;

  const postSaleWarning =
    'Regla antiaplicación (Art. 33.5.f LIRPF): tras vender un valor cotizado con pérdida, NO puedes recomprar el mismo ISIN durante los 2 meses posteriores (en ningún bróker). Si deseas mantener exposición al mercado, puedes rotar a un ETF o activo similar con distinto ISIN.';

  const executableToday: FifoSaleSuggestion[] = [];
  const executableInYearWindow: FifoSaleSuggestion[] = [];
  const fullLiquidationAlternatives: FifoSaleSuggestion[] = [];

  if (mode === 'target_cash') {
    // Modo liquidez con mínimo impacto fiscal: priorizar activos con pérdida libre -> menor ganancia % -> bloqueados en ventana
    let remainingCash = desiredCash;
    let runningNet = baseNetForPlan;

    const openAssets = engineResult.assets
      .filter((a) => a.openQty > EPSILON && a.currentPriceEur > EPSILON)
      .sort((a, b) => {
        // Prioridad: menor ganancia/pérdida por euro de liquidez (idealmente pérdidas libres primero)
        const ratioA = a.marketValueEur > EPSILON ? a.unrealizedGainLossEur / a.marketValueEur : 0;
        const ratioB = b.marketValueEur > EPSILON ? b.unrealizedGainLossEur / b.marketValueEur : 0;
        const penaltyA = a.unrealizedGainLossEur < 0 && a.washSale.status !== 'libre' ? 0.5 : 0;
        const penaltyB = b.unrealizedGainLossEur < 0 && b.washSale.status !== 'libre' ? 0.5 : 0;
        return ratioA + penaltyA - (ratioB + penaltyB);
      });

    let totalCashPlanned = 0;

    for (const asset of openAssets) {
      if (remainingCash <= 1) break;
      const isFractional = Math.abs(asset.openQty - Math.round(asset.openQty)) > 1e-4;
      const rawQty = remainingCash / asset.currentPriceEur;
      const qty = Math.min(
        asset.openQty,
        isFractional ? round4(rawQty) : Math.min(asset.openQty, Math.ceil(rawQty - EPSILON))
      );
      if (qty <= EPSILON) continue;

      const sim = simulateFifoSale(asset, qty, asset.currentPriceEur, refDate, runningNet, fiscalYear);
      const effectiveGain = sim.washSaleBlocked ? 0 : sim.gainLossEur;
      runningNet = round2(runningNet + effectiveGain);
      remainingCash = Math.max(0, remainingCash - sim.estimatedProceedsEur);
      totalCashPlanned += sim.estimatedProceedsEur;

      const suggestion: FifoSaleSuggestion = {
        category:
          sim.washSaleEffectiveStatus === 'libre'
            ? 'executable_today'
            : sim.washSaleEffectiveStatus === 'bloqueada_ventana_anio'
              ? 'executable_year_window'
              : 'full_liquidation_alternative',
        groupKey: asset.groupKey,
        isin: asset.isin,
        name: asset.name,
        ticker: asset.ticker,
        brokers: asset.brokers,
        exchanges: asset.exchanges,
        qtyToSell: sim.qtySimulated,
        totalOpenQty: asset.openQty,
        isFullLiquidation: sim.isFullLiquidation,
        currentPriceEur: asset.currentPriceEur,
        estimatedProceedsEur: sim.estimatedProceedsEur,
        costBasisEur: sim.costBasisEur,
        estimatedGainLossEur: sim.gainLossEur,
        estimatedTaxSavingsEur: sim.taxImpact.taxDeltaEur,
        washSaleStatus: sim.washSaleEffectiveStatus,
        recommendedExecutionDate:
          sim.washSaleEffectiveStatus === 'bloqueada_ventana_anio' && asset.washSale.unlockDate
            ? asset.washSale.unlockDate
            : engineResult.referenceDateIso,
        reason: `Aporta ${formatEurEs(sim.estimatedProceedsEur)} de liquidez con efecto fiscal de ${formatEurEs(sim.gainLossEur)}. ${sim.washSaleNote}`,
        consumedLots: sim.consumedLots,
      };

      if (suggestion.category === 'executable_today') executableToday.push(suggestion);
      else if (suggestion.category === 'executable_year_window') executableInYearWindow.push(suggestion);
      else fullLiquidationAlternatives.push(suggestion);
    }

    const projectedTaxAfterPlanEur = calculateSpanishSavingsTax(runningNet).taxEur;
    const estimatedTaxSavingsEur = round2(taxBeforePlanEur - projectedTaxAfterPlanEur);

    return {
      fiscalYear,
      mode,
      currentRealizedNetEur,
      currentComputableNetEur,
      targetExtraGainEur: round2(extraGain),
      targetCashEur: round2(desiredCash),
      targetLossNeededEur: Math.max(0, baseNetForPlan),
      taxBeforePlanEur,
      offsetAvailableTodayEur: 0,
      offsetAvailableInWindowEur: 0,
      totalOffsetPlannedEur: round2(Math.max(0, baseNetForPlan - runningNet)),
      projectedNetAfterPlanEur: runningNet,
      projectedTaxAfterPlanEur,
      estimatedTaxSavingsEur,
      projectedCashGeneratedEur: round2(totalCashPlanned),
      executableToday,
      executableInYearWindow,
      fullLiquidationAlternatives,
      postSaleWarning,
      headline: `Plan de liquidez (${formatEurEs(desiredCash)}): efectivo estimado ${formatEurEs(totalCashPlanned)} con IRPF proyectado de ${formatEurEs(projectedTaxAfterPlanEur)}.`,
    };
  }

  // Modo CERO IMPUESTOS: neutralizar baseNetForPlan si > 0
  const targetLossNeededEur = baseNetForPlan > 0 ? round2(baseNetForPlan) : 0;

  if (targetLossNeededEur <= EPSILON) {
    return {
      fiscalYear,
      mode,
      currentRealizedNetEur,
      currentComputableNetEur,
      targetExtraGainEur: round2(extraGain),
      targetCashEur: 0,
      targetLossNeededEur: 0,
      taxBeforePlanEur: 0,
      offsetAvailableTodayEur: 0,
      offsetAvailableInWindowEur: 0,
      totalOffsetPlannedEur: 0,
      projectedNetAfterPlanEur: baseNetForPlan,
      projectedTaxAfterPlanEur: 0,
      estimatedTaxSavingsEur: 0,
      projectedCashGeneratedEur: 0,
      executableToday: [],
      executableInYearWindow: [],
      fullLiquidationAlternatives: [],
      postSaleWarning,
      headline: `Tu saldo fiscal computable en ${fiscalYear} es ${formatEurEs(baseNetForPlan)} (IRPF 0,00 €). No necesitas realizar pérdidas adicionales para dejar la factura a cero.`,
    };
  }

  // Candidatos con pérdidas latentes
  const lossCandidates = engineResult.assets.filter(
    (a) => a.openQty > EPSILON && a.unrealizedGainLossEur < -1
  );

  // Separar por estado regla 2 meses
  const freeCandidates = lossCandidates
    .filter((a) => a.washSale.status === 'libre')
    .sort((a, b) => a.unrealizedGainLossEur - b.unrealizedGainLossEur); // mayor pérdida primero

  const windowCandidates = lossCandidates
    .filter((a) => a.washSale.status === 'bloqueada_ventana_anio')
    .sort((a, b) => a.unrealizedGainLossEur - b.unrealizedGainLossEur);

  const blockedOutsideYearCandidates = lossCandidates
    .filter((a) => a.washSale.status === 'bloqueada_fuera_anio')
    .sort((a, b) => a.unrealizedGainLossEur - b.unrealizedGainLossEur);

  let remainingToOffset = targetLossNeededEur;
  let runningNet = baseNetForPlan;
  let offsetToday = 0;
  let offsetInWindow = 0;
  let totalCashPlanned = 0;

  // 1. Ejecutables HOY sin bloqueo
  for (const asset of freeCandidates) {
    if (remainingToOffset <= 0.5) break;
    const qty = findOptimalLossSaleQty(asset, remainingToOffset);
    if (qty <= EPSILON) continue;

    const sim = simulateFifoSale(asset, qty, asset.currentPriceEur, refDate, runningNet, fiscalYear);
    if (sim.gainLossEur >= 0) continue;

    const absLoss = Math.abs(sim.gainLossEur);
    runningNet = round2(runningNet + sim.gainLossEur);
    remainingToOffset = Math.max(0, round2(remainingToOffset - absLoss));
    offsetToday += absLoss;
    totalCashPlanned += sim.estimatedProceedsEur;

    executableToday.push({
      category: 'executable_today',
      groupKey: asset.groupKey,
      isin: asset.isin,
      name: asset.name,
      ticker: asset.ticker,
      brokers: asset.brokers,
      exchanges: asset.exchanges,
      qtyToSell: sim.qtySimulated,
      totalOpenQty: asset.openQty,
      isFullLiquidation: sim.isFullLiquidation,
      currentPriceEur: asset.currentPriceEur,
      estimatedProceedsEur: sim.estimatedProceedsEur,
      costBasisEur: sim.costBasisEur,
      estimatedGainLossEur: sim.gainLossEur,
      estimatedTaxSavingsEur: sim.taxImpact.taxDeltaEur,
      washSaleStatus: 'libre',
      recommendedExecutionDate: engineResult.referenceDateIso,
      reason: `Libre de regla 2 meses hoy. Vender ${sim.qtySimulated} títulos cristaliza ${formatEurEs(sim.gainLossEur)} y ahorra ${formatEurEs(sim.taxImpact.taxDeltaEur)} en IRPF.`,
      consumedLots: sim.consumedLots,
    });
  }

  // 2. Ejecutables en ventana libre antes del 31/12 (ej. Gold 3X a partir del 23/12/2026)
  for (const asset of windowCandidates) {
    if (remainingToOffset <= 0.5) break;
    const qty = findOptimalLossSaleQty(asset, remainingToOffset);
    if (qty <= EPSILON) continue;

    const unlockDateObj = asset.washSale.unlockDate
      ? isoToUtcDate(asset.washSale.unlockDate)
      : refDate;
    // Simulamos la venta en la fecha de desbloqueo (cuando ya está libre)
    const assetAtUnlock: FifoAssetSummary = {
      ...asset,
      washSale: { ...asset.washSale, status: 'libre' },
    };
    const sim = simulateFifoSale(
      assetAtUnlock,
      qty,
      asset.currentPriceEur,
      unlockDateObj,
      runningNet,
      fiscalYear
    );
    if (sim.gainLossEur >= 0) continue;

    const absLoss = Math.abs(sim.gainLossEur);
    runningNet = round2(runningNet + sim.gainLossEur);
    remainingToOffset = Math.max(0, round2(remainingToOffset - absLoss));
    offsetInWindow += absLoss;
    totalCashPlanned += sim.estimatedProceedsEur;

    executableInYearWindow.push({
      category: 'executable_year_window',
      groupKey: asset.groupKey,
      isin: asset.isin,
      name: asset.name,
      ticker: asset.ticker,
      brokers: asset.brokers,
      exchanges: asset.exchanges,
      qtyToSell: sim.qtySimulated,
      totalOpenQty: asset.openQty,
      isFullLiquidation: sim.isFullLiquidation,
      currentPriceEur: asset.currentPriceEur,
      estimatedProceedsEur: sim.estimatedProceedsEur,
      costBasisEur: sim.costBasisEur,
      estimatedGainLossEur: sim.gainLossEur,
      estimatedTaxSavingsEur: sim.taxImpact.taxDeltaEur,
      washSaleStatus: 'bloqueada_ventana_anio',
      recommendedExecutionDate: asset.washSale.unlockDate || `${fiscalYear}-12-23`,
      reason: `Programar venta de ${sim.qtySimulated} títulos a partir del ${asset.washSale.unlockDate} (${asset.washSale.windowDaysBeforeYearEnd} días de ventana libre antes del 31/12/${fiscalYear}). Cristaliza ${formatEurEs(sim.gainLossEur)} y ahorra ${formatEurEs(sim.taxImpact.taxDeltaEur)}.`,
      consumedLots: sim.consumedLots,
    });
  }

  // 3. Alternativa de liquidación total (100% del ISIN) para activos actualmente bloqueados
  // Se ofrece siempre como opción alternativa para quien quiera ejecutar HOY sin esperar a la ventana
  const blockedForAlt = [...windowCandidates, ...blockedOutsideYearCandidates];
  for (const asset of blockedForAlt) {
    const simFull = simulateFifoSale(
      asset,
      asset.openQty,
      asset.currentPriceEur,
      refDate,
      baseNetForPlan,
      fiscalYear
    );
    if (simFull.gainLossEur >= 0) continue;

    fullLiquidationAlternatives.push({
      category: 'full_liquidation_alternative',
      groupKey: asset.groupKey,
      isin: asset.isin,
      name: asset.name,
      ticker: asset.ticker,
      brokers: asset.brokers,
      exchanges: asset.exchanges,
      qtyToSell: simFull.qtySimulated,
      totalOpenQty: asset.openQty,
      isFullLiquidation: true,
      currentPriceEur: asset.currentPriceEur,
      estimatedProceedsEur: simFull.estimatedProceedsEur,
      costBasisEur: simFull.costBasisEur,
      estimatedGainLossEur: simFull.gainLossEur,
      estimatedTaxSavingsEur: simFull.taxImpact.taxDeltaEur,
      washSaleStatus: 'libre',
      recommendedExecutionDate: engineResult.referenceDateIso,
      reason: `Alternativa ejecutable HOY: liquidar el 100% (${asset.openQty} títulos de ${asset.isin}) libera por completo la regla de los 2 meses. Genera ${formatEurEs(simFull.gainLossEur)} (ahorro hasta ${formatEurEs(simFull.taxImpact.taxDeltaEur)}). No recomprar el mismo ISIN en 2 meses.`,
      consumedLots: simFull.consumedLots,
    });
  }

  const totalOffsetPlannedEur = round2(offsetToday + offsetInWindow);
  const projectedNetAfterPlanEur = round2(runningNet);
  const projectedTaxAfterPlanEur = calculateSpanishSavingsTax(projectedNetAfterPlanEur).taxEur;
  const estimatedTaxSavingsEur = round2(Math.max(0, taxBeforePlanEur - projectedTaxAfterPlanEur));

  const headline =
    projectedTaxAfterPlanEur === 0
      ? `Plan Cero Impuestos ${fiscalYear}: puedes neutralizar ${formatEurEs(targetLossNeededEur)} de plusvalía y ahorrar ${formatEurEs(estimatedTaxSavingsEur)} en IRPF.`
      : `Plan de optimización ${fiscalYear}: puedes compensar ${formatEurEs(totalOffsetPlannedEur)} y ahorrar ${formatEurEs(estimatedTaxSavingsEur)} (IRPF restante: ${formatEurEs(projectedTaxAfterPlanEur)}).`;

  return {
    fiscalYear,
    mode,
    currentRealizedNetEur,
    currentComputableNetEur,
    targetExtraGainEur: round2(extraGain),
    targetCashEur: 0,
    targetLossNeededEur,
    taxBeforePlanEur,
    offsetAvailableTodayEur: round2(offsetToday),
    offsetAvailableInWindowEur: round2(offsetInWindow),
    totalOffsetPlannedEur,
    projectedNetAfterPlanEur,
    projectedTaxAfterPlanEur,
    estimatedTaxSavingsEur,
    projectedCashGeneratedEur: round2(totalCashPlanned),
    executableToday,
    executableInYearWindow,
    fullLiquidationAlternatives,
    postSaleWarning,
    headline,
  };
}

// ============================================================================
// 6. PARSER CSV ROBUSTO (DEGIRO Transactions.csv + GENÉRICO)
// ============================================================================

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseTransactionsCsv(
  csvText: string,
  brokerName = 'DEGIRO'
): CustomFifoTransaction[] {
  if (!csvText || !csvText.trim()) return [];

  const cleanText = csvText.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(cleanText);
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const rawHeaders = splitCsvRow(lines[0], delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  const findCol = (patterns: string[], exclude?: string[]): number => {
    for (const p of patterns) {
      const idx = headers.findIndex((h) => {
        if (exclude && exclude.some((ex) => h.includes(ex))) return false;
        return h === p || h.includes(p);
      });
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateCol = findCol(['fecha', 'date', 'data']);
  const timeCol = findCol(['hora', 'time']);
  const nameCol = findCol(['producto', 'product', 'nombre', 'name', 'activo', 'asset', 'titulo']);
  const isinCol = findCol(['isin']);
  const tickerCol = findCol(['ticker', 'simbolo', 'symbol']);
  const exchangeCol = findCol(['bolsa de', 'bolsa', 'reference exchange', 'exchange', 'mercado', 'venue']);
  const qtyCol = findCol(['cantidad', 'quantity', 'numero', 'titulos', 'shares', 'acciones', 'qty']);
  const priceCol = findCol(['precio', 'price', 'cotizacion']);
  const feesCol = findCol([
    'costes de transaccion',
    'transaction costs',
    'comision',
    'commission',
    'fees',
    'fee',
    'gastos',
  ]);
  const autoFxCol = findCol(['autofx', 'coste autofx', 'fx fee']);
  const totalCol = findCol(['total', 'importe neto', 'net', 'valor neto'], ['local', 'mercado']);
  const valueEurCol = findCol(['valor', 'value'], ['local']);
  const sideCol = findCol(['tipo', 'operacion', 'side', 'action', 'compra/venta']);

  if (dateCol === -1 || qtyCol === -1) return [];

  const results: CustomFifoTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i], delimiter);
    if (cols.length < 3) continue;

    const rawDate = (cols[dateCol] || '').trim();
    const rawTime = timeCol !== -1 ? (cols[timeCol] || '').trim() : '00:00';
    const parsedDate = parseFlexibleDate(rawDate, rawTime);
    if (!parsedDate) continue;

    let qty = sanitizeFinancialNumber(cols[qtyCol]);
    if (Math.abs(qty) < EPSILON) continue;

    // Si hay columna de tipo Compra/Venta y qty viene siempre en positivo
    if (sideCol !== -1) {
      const sideVal = normalizeHeader(cols[sideCol] || '');
      if (sideVal.includes('vent') || sideVal.includes('sell')) {
        qty = -Math.abs(qty);
      } else if (sideVal.includes('compr') || sideVal.includes('buy')) {
        qty = Math.abs(qty);
      }
    }

    const price = priceCol !== -1 ? Math.abs(sanitizeFinancialNumber(cols[priceCol])) : 0;
    const feePart = feesCol !== -1 ? Math.abs(sanitizeFinancialNumber(cols[feesCol])) : 0;
    const fxPart = autoFxCol !== -1 ? Math.abs(sanitizeFinancialNumber(cols[autoFxCol])) : 0;
    const feesEur = round2(feePart + fxPart);

    let netEur = 0;
    if (totalCol !== -1 && (cols[totalCol] || '').trim() !== '') {
      netEur = sanitizeFinancialNumber(cols[totalCol]);
      // Normalizar signo coherente con qty: compra = negativo, venta = positivo
      if (qty > 0 && netEur > 0) netEur = -netEur;
      if (qty < 0 && netEur < 0) netEur = Math.abs(netEur);
    } else if (valueEurCol !== -1 && (cols[valueEurCol] || '').trim() !== '') {
      const val = sanitizeFinancialNumber(cols[valueEurCol]);
      netEur = qty > 0 ? -(Math.abs(val) + feesEur) : Math.max(0, Math.abs(val) - feesEur);
    } else {
      const gross = Math.abs(qty) * price;
      netEur = qty > 0 ? -(gross + feesEur) : Math.max(0, gross - feesEur);
    }

    const name = nameCol !== -1 ? (cols[nameCol] || '').trim() : '';
    const isinRaw = isinCol !== -1 ? (cols[isinCol] || '').trim().toUpperCase() : '';
    const ticker = tickerCol !== -1 ? (cols[tickerCol] || '').trim().toUpperCase() : isinRaw;
    const isin = isinRaw || ticker || name;
    if (!isin) continue;

    const exchange = exchangeCol !== -1 ? (cols[exchangeCol] || '').trim() : brokerName;

    results.push({
      id: `csv-${brokerKey(brokerName)}-${i}`,
      date: parsedDate.iso,
      time: parsedDate.time,
      isin,
      name: name || isin,
      ticker: ticker || isin,
      broker: normalizeBrokerName(brokerName),
      exchange: exchange || brokerName,
      quantity: qty,
      price,
      feesEur,
      netEur: round2(netEur),
    });
  }

  return results;
}

// ============================================================================
// 7. RESUMEN COMPACTO PARA EL ASISTENTE DOMINGO (geminiAssistantService.ts)
// ============================================================================

export function buildFifoContextForDomingo(engineResult: FifoEngineResult): string {
  const { fiscalYear, consolidateByIsin, selectedBrokers, yearSummary, assets, optimizationPlan } =
    engineResult;

  const lines: string[] = [
    `=== AUDITORÍA FISCAL FIFO ${fiscalYear} (AEAT España - LIRPF) ===`,
    `Criterio: ${consolidateByIsin ? 'Consolidado por ISIN (Art. 37.2 LIRPF - Oficial AEAT)' : 'Separado por posición/bolsa (comparativo)'} | Brókers: ${selectedBrokers.join(', ')} | Fecha ref.: ${engineResult.referenceDateIso}`,
    `Realizado ${fiscalYear}: Plusvalías +${formatEurEs(yearSummary.realizedGainsEur)} | Minusvalías ${formatEurEs(yearSummary.realizedLossesEur)} | Neto realizado: ${formatEurEs(yearSummary.realizedNetEur)}`,
  ];

  if (yearSummary.deferredLossesEur > 0) {
    lines.push(
      `Regla 2 meses en ventas ${fiscalYear}: ${formatEurEs(yearSummary.deferredLossesEur)} en pérdidas diferidas -> Base imponible computable: ${formatEurEs(yearSummary.computableNetEur)}`
    );
  }

  lines.push(
    `IRPF estimado Base del Ahorro: ${formatEurEs(yearSummary.taxEstimate.taxEur)} (tipo efectivo ${(yearSummary.taxEstimate.effectiveRate * 100).toFixed(2)}%, marginal ${(yearSummary.taxEstimate.marginalRate * 100).toFixed(0)}%) | Comisiones año: ${formatEurEs(yearSummary.feesYearEur)}`,
    `Cartera abierta FIFO: Coste ${formatEurEs(engineResult.totalOpenCostBasisEur)} | Mercado ${formatEurEs(engineResult.totalMarketValueEur)} | Latente neto: ${formatEurEs(engineResult.netUnrealizedEur)}`,
    `--- Detalle por activo ---`
  );

  for (const a of assets) {
    const statusLabel =
      a.washSale.status === 'libre'
        ? 'LIBRE HOY'
        : a.washSale.status === 'bloqueada_ventana_anio'
          ? `VENTANA LIBRE DESDE ${a.washSale.unlockDate}`
          : `BLOQUEADA HASTA ${a.washSale.unlockDate}`;
    lines.push(
      `• ${a.name} (${a.isin}) | Abiertos: ${a.openQty} uds | Coste FIFO: ${formatEurEs(a.fifoAvgCostEur)} | Precio: ${formatEurEs(a.currentPriceEur)} | Latente: ${formatEurEs(a.unrealizedGainLossEur)} (${a.unrealizedGainLossPct}%) | Realizado ${fiscalYear}: ${formatEurEs(a.realizedNetYearEur)} | Regla 2M: ${statusLabel}`
    );
  }

  lines.push(`--- Plan Optimización Fiscal ---`, optimizationPlan.headline);

  if (optimizationPlan.executableToday.length > 0) {
    lines.push(
      `Ejecutables HOY: ${optimizationPlan.executableToday
        .map((s) => `${s.ticker} vender ${s.qtyToSell} uds (${formatEurEs(s.estimatedGainLossEur)})`)
        .join('; ')}`
    );
  }
  if (optimizationPlan.executableInYearWindow.length > 0) {
    lines.push(
      `En ventana antes 31/12: ${optimizationPlan.executableInYearWindow
        .map(
          (s) =>
            `${s.ticker} vender ${s.qtyToSell} uds desde ${s.recommendedExecutionDate} (${formatEurEs(s.estimatedGainLossEur)})`
        )
        .join('; ')}`
    );
  }
  if (optimizationPlan.fullLiquidationAlternatives.length > 0) {
    lines.push(
      `Alternativa liquidación 100% HOY: ${optimizationPlan.fullLiquidationAlternatives
        .map((s) => `${s.ticker} (${s.totalOpenQty} uds -> ${formatEurEs(s.estimatedGainLossEur)})`)
        .join('; ')}`
    );
  }

  return lines.join('\n');
}
