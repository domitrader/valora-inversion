import { PortfolioState, PositionItem } from '../types/portfolio';
import { calculatePortfolioMetrics, formatEUR } from '../utils/calculations';
import degiroChartsRaw from '../data/degiroChartsData.json';
import degiroDividendsRaw from '../data/degiroDividendsData.json';
import degiroPositionsRaw from '../data/degiroPositionsData.json';
import degiroCoreEtfsRaw from '../data/degiroCoreEtfs.json';
import { runFifoTaxEngine, buildFifoContextForDomingo } from '../utils/fifoTaxEngine';

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenText?: string;
  timestamp: string;
  source?: 'gemini' | 'local';
  modelUsed?: string;
}

export type GeminiModelChoice =
  | 'gemini-3.6-flash'
  | 'gemini-3.8-flash'
  | 'gemini-3.5-flash'
  | 'gemini-3.5-flash-lite';

const STORAGE_KEY_API = 'valora_domingo_gemini_api_key';
const STORAGE_KEY_MODEL = 'valora_domingo_gemini_model';

export function getStoredGeminiApiKey(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY_API) || '').trim();
  } catch {
    return '';
  }
}

export function setStoredGeminiApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY_API, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  } catch (e) {
    console.warn('No se pudo guardar la clave de Gemini en localStorage:', e);
  }
}

export function getStoredGeminiModel(): GeminiModelChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL) as GeminiModelChoice | null;
    if (
      saved === 'gemini-3.6-flash' ||
      saved === 'gemini-3.8-flash' ||
      saved === 'gemini-3.5-flash' ||
      saved === 'gemini-3.5-flash-lite'
    ) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'gemini-3.6-flash';
}

export function setStoredGeminiModel(model: GeminiModelChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, model);
  } catch {
    // ignore
  }
}

interface YearlyAuditItem {
  year: number;
  netPnl: number;
  fees: number;
  trades: number;
  deposits: number;
  withdrawals: number;
  netCashFlow: number;
  peakCapital: number;
  roiPct: number;
  months: { m: number; netPnl: number; fees: number; trades: number; roiPct: number }[];
}

interface TopMoverItem {
  id: string;
  name: string;
  exchange: string;
  netPnl: number;
  fees: number;
  trades: number;
  isOpen: boolean;
}

const chartsData = degiroChartsRaw as {
  yearly: YearlyAuditItem[];
  topWinners: TopMoverItem[];
  topLosers: TopMoverItem[];
};

const dividendsData = degiroDividendsRaw as {
  totalHistoricalNet: number;
  totalHistoricalGross: number;
  totalHistoricalTaxes: number;
  totalPaymentsCount: number;
  annualSummary: { year: string; gross: number; tax: number; net: number; count: number }[];
  byProduct?: { product: string; isin: string; gross: number; tax: number; net: number; count: number }[];
  futureProjections?: { product: string; ticker: string; estimatedDate: string; estimatedNetEUR: number }[];
};

const closedPositionsList = ((degiroPositionsRaw as { closedPositions?: Array<{
  name: string;
  isin: string;
  realized_pnl: number;
  total_fees: number;
  trades_count: number;
}> }).closedPositions || []);

const coreEtfsCount = Array.isArray(degiroCoreEtfsRaw) ? degiroCoreEtfsRaw.length : 200;

/**
 * Construye una radiografía completa y exacta de todas las carteras y datos auditados de Domingo
 * para inyectarla como contexto del sistema en Gemini.
 */
export function buildDomingoPortfolioContext(
  portfolioState: PortfolioState,
  lastUpdatedTime?: string
): string {
  const defaultPortId = portfolioState.portfolios[0]?.id || 'port-main';
  const activePort =
    portfolioState.portfolios.find((p) => p.id === portfolioState.activePortfolioId) ||
    portfolioState.portfolios[0];

  let grandTotalMarketValue = 0;
  let grandTotalPositionsVal = 0;
  let grandTotalCash = 0;
  let grandDailyChange = 0;

  const portfolioSummaries = portfolioState.portfolios.map((port) => {
    const isDefault = port.id === defaultPortId;
    const portPositions = portfolioState.positions.filter(
      (pos) => (pos.portfolioId || defaultPortId) === port.id
    );
    const portCash = isDefault
      ? port.cash !== undefined
        ? port.cash
        : portfolioState.cash
      : port.cash ?? 0;
    const portGoal = port.goalAmount ?? portfolioState.goalAmount;
    const metrics = calculatePortfolioMetrics(portPositions, portCash);
    const posVal = Number(portPositions.reduce((s, p) => s + (p.totalValue || 0), 0).toFixed(2));
    const totalVal = Number((posVal + portCash).toFixed(2));
    const dayBp = Number(portPositions.reduce((s, p) => s + (p.dailyChangeValue || 0), 0).toFixed(2));
    const totalBp = isDefault
      ? Number((totalVal - 2051.33).toFixed(2))
      : Number(portPositions.reduce((s, p) => s + (p.unrealizedGainLoss || 0), 0).toFixed(2));
    const goalPct = portGoal > 0 ? Math.min(100, Math.round((totalVal / portGoal) * 100)) : 0;

    grandTotalMarketValue += totalVal;
    grandTotalPositionsVal += posVal;
    grandTotalCash += portCash;
    grandDailyChange += dayBp;

    const posLines =
      portPositions.length === 0
        ? '    (Sin posiciones abiertas actualmente)'
        : portPositions
            .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
            .map((p) => {
              const weight = posVal > 0 ? (((p.totalValue || 0) / posVal) * 100).toFixed(1) : '0.0';
              return `    - ${p.name} (${p.ticker}${p.isin ? ` / ${p.isin}` : ''}) [${p.type}]: ${p.shares} tít. | Precio actual: ${p.currentPrice.toFixed(2)} ${p.currency} | Precio medio: ${p.avgPrice.toFixed(2)} | Valor: ${p.totalValue.toFixed(2)} € (${weight}% cartera) | Hoy: ${p.dailyChangeValue >= 0 ? '+' : ''}${p.dailyChangeValue.toFixed(2)} € (${p.dailyChangePct >= 0 ? '+' : ''}${p.dailyChangePct.toFixed(2)}%) | Latente: ${p.unrealizedGainLoss >= 0 ? '+' : ''}${p.unrealizedGainLoss.toFixed(2)} € (${p.unrealizedGainLossPct.toFixed(2)}%)`;
            })
            .join('\n');

    return [
      `• Cartera "${port.name}"${port.id === activePort?.id ? ' [ACTIVA EN PANTALLA]' : ''}:`,
      `  - Cuenta completa: ${totalVal.toFixed(2)} € (Invertido: ${posVal.toFixed(2)} € | Efectivo: ${portCash.toFixed(2)} €)`,
      `  - Día B/P: ${dayBp >= 0 ? '+' : ''}${dayBp.toFixed(2)} € (${metrics.dailyChangePct.toFixed(2)}%) | Total B/P: ${totalBp >= 0 ? '+' : ''}${totalBp.toFixed(2)} €`,
      `  - Meta de inversión: ${portGoal.toFixed(0)} € (${goalPct}% completado, faltan ${Math.max(0, portGoal - totalVal).toFixed(2)} €)`,
      `  - Posiciones abiertas (${portPositions.length}):`,
      posLines,
    ].join('\n');
  });

  const analytics = portfolioState.tradingAnalytics;
  const yearlyLines = chartsData.yearly
    .map(
      (y) =>
        `  - Año ${y.year}: B/P Neto Realizado ${y.netPnl >= 0 ? '+' : ''}${y.netPnl.toFixed(2)} € | ROI ${y.roiPct >= 0 ? '+' : ''}${y.roiPct.toFixed(2)}% | Comisiones ${y.fees.toFixed(2)} € | ${y.trades} operaciones | Ingresos ${y.deposits.toFixed(0)} € / Retiradas ${y.withdrawals.toFixed(0)} €`
    )
    .join('\n');

  const winnersLines = chartsData.topWinners
    .slice(0, 8)
    .map((w) => `  - ${w.name}: +${w.netPnl.toFixed(2)} € netos (${w.trades} ops, comisiones ${w.fees.toFixed(2)} €)`)
    .join('\n');

  const losersLines = chartsData.topLosers
    .slice(0, 8)
    .map((l) => `  - ${l.name}: ${l.netPnl.toFixed(2)} € netos (${l.trades} ops, comisiones ${l.fees.toFixed(2)} €)`)
    .join('\n');

  const dividendAnnualLines = (dividendsData.annualSummary || [])
    .map((d) => `  - ${d.year}: Neto ${d.net.toFixed(2)} € (Bruto ${d.gross.toFixed(2)} €, Retención ${d.tax.toFixed(2)} €, ${d.count} cobros)`)
    .join('\n');

  const watchlistSummary =
    portfolioState.watchlist.length > 0
      ? portfolioState.watchlist
          .slice(0, 15)
          .map((w) => `${w.name} (${w.ticker}: ${w.price} ${w.currency}, hoy ${w.dailyChangePct >= 0 ? '+' : ''}${w.dailyChangePct.toFixed(2)}%)`)
          .join('; ')
      : 'Sin activos en seguimiento';

  let fifoFiscalSection = '';
  try {
    const fifoResult = runFifoTaxEngine({
      positions: portfolioState.positions,
      selectedBrokers: ['DEGIRO'],
      fiscalYear: new Date().getFullYear(),
      consolidateByIsin: true,
    });
    fifoFiscalSection = buildFifoContextForDomingo(fifoResult);
  } catch (err) {
    console.warn('No se pudo calcular la auditoría fiscal FIFO para Domingo:', err);
    fifoFiscalSection = 'Auditoría fiscal FIFO no disponible temporalmente.';
  }

  return `
ERES EL ASISTENTE FINANCIERO PERSONAL POR VOZ DE DOMINGO EN SU WEB "VALORA INVERSIÓN" (https://domitrader.github.io/valora-inversion/).
Fecha y hora actual de cotizaciones: ${lastUpdatedTime || 'Tiempo real'}.

INSTRUCCIONES DE ESTILO Y COMPORTAMIENTO:
1. Habla siempre en español de España, cercano, claro, directo y riguroso con los números exactos de Domingo. Llámale "Domingo" con naturalidad cuando encaje.
2. Nunca inventes cifras: usa exclusivamente los datos reales detallados abajo.
3. Si Domingo te pide analizar una cartera, activo, riesgo, diversificación, dividendos, comisiones, metas, impuestos, IRPF, regla de los 2 meses o comparativa entre brokers, dale conclusiones prácticas, porcentajes exactos y puntos accionables claros.
4. Sé ágil para lectura por voz: estructura tus respuestas con frases limpias y viñetas breves; evita tablas enormes difíciles de escuchar.

=== PATRIMONIO CONSOLIDADO GLOBAL DE DOMINGO (TODAS LAS CARTERAS) ===
- Patrimonio Total Consolidado: ${grandTotalMarketValue.toFixed(2)} €
- Total Invertido en Activos: ${grandTotalPositionsVal.toFixed(2)} €
- Liquidez / Efectivo Total: ${grandTotalCash.toFixed(2)} €
- Variación total del día hoy: ${grandDailyChange >= 0 ? '+' : ''}${grandDailyChange.toFixed(2)} €
- Cartera seleccionada ahora mismo en pantalla: "${activePort?.name || 'DEGIRO'}"

=== DETALLE POR CARTERA (${portfolioState.portfolios.length} CARTERAS: DEGIRO, MYINVESTOR, COINBASE, BITVAVO, BBVA) ===
${portfolioSummaries.join('\n\n')}

=== HISTORIAL AUDITADO DEGIRO (2018–2026) ===
- Periodo: ${analytics?.startDate || '2018'} a ${analytics?.endDate || '2026'}
- Total operaciones ejecutadas: ${analytics?.totalTrades ?? 2847}
- Beneficio Cerrado Realizado Total: ${analytics?.totalRealizedPnl !== undefined ? `${analytics.totalRealizedPnl.toFixed(2)} €` : '+21.989,09 €'}
- Comisiones totales pagadas: ${analytics?.totalFeesPaid !== undefined ? `${analytics.totalFeesPaid.toFixed(2)} €` : '7.200,45 €'}
- Total depositado: ${analytics?.totalDeposited ?? 81285} € | Total retirado: ${analytics?.totalWithdrawn ?? 111496.15} €
- Total activos cerrados históricos registrados: ${closedPositionsList.length}

Desglose anual auditado DEGIRO (2018–2026):
${yearlyLines}

Top Mayores Ganadores Históricos DEGIRO:
${winnersLines}

Top Mayores Pérdidas Históricas DEGIRO:
${losersLines}

=== AUDITORÍA FISCAL FIFO (IRPF ESPAÑA / HACIENDA) ===
${fifoFiscalSection}

=== DIVIDENDOS AUDITADOS (2018–2026) ===
- Total Neto Cobrado: ${dividendsData.totalHistoricalNet.toFixed(2)} € (Bruto: ${dividendsData.totalHistoricalGross.toFixed(2)} € | Retenciones fiscales: ${dividendsData.totalHistoricalTaxes.toFixed(2)} € en ${dividendsData.totalPaymentsCount} pagos)
${dividendAnnualLines}

=== TARIFAS Y BUSCADORES INTEGRADOS EN LA WEB ===
- DEGIRO: Acciones España/EE.UU. 1 € + 1 € tramitación = 2 €; Tradegate/XETRA 3,90 € + 1 € = 4,90 €; ${coreEtfsCount} ETFs Core Selection sin comisión de compra/venta (solo 1 € tramitación); AutoFX cambio divisa 0,25%; Conectividad mercados extranjeros 2,50 €/año por bolsa.
- MyInvestor: Fondos indexados y activos 0% comisión custodia/compra; Acciones y ETFs 0,12% (mín. 3 €, máx. 25 €) + cambio divisa 0,30%.
- Cripto y Banca: Carteras dedicadas creadas para Coinbase, Bitvavo (comisiones spot muy bajas 0,05%-0,25% en EUR) y BBVA.

=== LISTA DE SEGUIMIENTO (WATCHLIST) ===
${watchlistSummary}
`.trim();
}

/**
 * Limpia el texto Markdown para que el sintetizador de voz en español lo lea con total naturalidad.
 */
export function cleanTextForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-•*]\s+/gm, '. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\|/g, ', ')
    .replace(/\bB\/P\b/gi, 'beneficio o pérdida')
    .replace(/\bETF\b/g, 'E T F')
    .replace(/\bETFs\b/g, 'E T Fs')
    .replace(/\bYTD\b/g, 'en lo que va de año')
    .replace(/\bROI\b/g, 'rentabilidad')
    .replace(/€/g, ' euros')
    .replace(/\+/g, ' más ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Motor Analítico Local Instantáneo (0 €, sin conexión ni API Key necesaria).
 * Responde al instante con los datos reales de Domingo cuando aún no se ha pegado clave de Gemini o falla la red.
 */
export function answerWithLocalAnalyst(
  query: string,
  portfolioState: PortfolioState
): { content: string; spokenText: string } {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const defaultPortId = portfolioState.portfolios[0]?.id || 'port-main';
  const activePort =
    portfolioState.portfolios.find((p) => p.id === portfolioState.activePortfolioId) ||
    portfolioState.portfolios[0];

  // Cálculos consolidados y por cartera
  const perPortfolio = portfolioState.portfolios.map((port) => {
    const isDefault = port.id === defaultPortId;
    const positions = portfolioState.positions.filter(
      (p) => (p.portfolioId || defaultPortId) === port.id
    );
    const cash = isDefault
      ? port.cash !== undefined
        ? port.cash
        : portfolioState.cash
      : port.cash ?? 0;
    const goal = port.goalAmount ?? portfolioState.goalAmount;
    const posVal = Number(positions.reduce((s, p) => s + (p.totalValue || 0), 0).toFixed(2));
    const totalVal = Number((posVal + cash).toFixed(2));
    const dayBp = Number(positions.reduce((s, p) => s + (p.dailyChangeValue || 0), 0).toFixed(2));
    const totalBp = isDefault
      ? Number((totalVal - 2051.33).toFixed(2))
      : Number(positions.reduce((s, p) => s + (p.unrealizedGainLoss || 0), 0).toFixed(2));
    return { port, positions, cash, goal, posVal, totalVal, dayBp, totalBp };
  });

  const totalGlobal = perPortfolio.reduce((s, p) => s + p.totalVal, 0);
  const totalCashGlobal = perPortfolio.reduce((s, p) => s + p.cash, 0);
  const totalDayGlobal = perPortfolio.reduce((s, p) => s + p.dayBp, 0);
  const activeStats = perPortfolio.find((p) => p.port.id === activePort?.id) || perPortfolio[0];

  // 0. Consultas fiscales FIFO / IRPF / Hacienda / Regla de los 2 meses
  const fiscalKeywords = [
    'fifo',
    'hacienda',
    'irpf',
    'impuesto',
    'impuestos',
    'fiscal',
    'plusval',
    'minusval',
    'compensar',
    'regla de los 2 meses',
    'dos meses',
    'vender sin pagar',
    'la renta',
  ];
  if (fiscalKeywords.some((kw) => q.includes(kw))) {
    try {
      const fiscalYearMatch = q.match(/\b(2018|2019|2020|2021|2022|2023|2024|2025|2026)\b/);
      const fiscalYear = fiscalYearMatch ? Number(fiscalYearMatch[1]) : new Date().getFullYear();
      const fifoResult = runFifoTaxEngine({
        positions: portfolioState.positions,
        selectedBrokers: ['DEGIRO'],
        fiscalYear,
        consolidateByIsin: true,
      });
      const { yearSummary, optimizationPlan } = fifoResult;

      const lines: string[] = [
        `**Auditoría Fiscal FIFO ${fiscalYear} (IRPF España · Consolidado por ISIN):**`,
        `- **Neto realizado ${fiscalYear}:** **${yearSummary.realizedNetEur >= 0 ? '+' : ''}${formatEUR(yearSummary.realizedNetEur)}** (Plusvalías: +${formatEUR(yearSummary.realizedGainsEur)} · Minusvalías: ${formatEUR(yearSummary.realizedLossesEur)})`,
        yearSummary.deferredLossesEur > 0
          ? `- **Pérdidas diferidas (Regla de los 2 meses):** **${formatEUR(yearSummary.deferredLossesEur)}** bloqueadas → Base imponible computable: **${yearSummary.computableNetEur >= 0 ? '+' : ''}${formatEUR(yearSummary.computableNetEur)}**`
          : `- **Pérdidas diferidas (Regla de los 2 meses):** ${formatEUR(0)} (Base imponible computable: **${yearSummary.computableNetEur >= 0 ? '+' : ''}${formatEUR(yearSummary.computableNetEur)}**)`,
        `- **Cuota IRPF estimada (Base del Ahorro):** **${formatEUR(yearSummary.taxEstimate.taxEur)}** (tipo efectivo ${(yearSummary.taxEstimate.effectiveRate * 100).toFixed(2)}%, marginal ${(yearSummary.taxEstimate.marginalRate * 100).toFixed(0)}%)`,
        `- **Plan de compensación óptimo:** ${optimizationPlan.headline}`,
      ];

      if (optimizationPlan.executableToday.length > 0) {
        const todayList = optimizationPlan.executableToday
          .map(
            (s) =>
              `${s.name} (${s.ticker}): vender ${s.qtyToSell} uds (${formatEUR(s.estimatedGainLossEur)}, ahorro aprox. ${formatEUR(s.estimatedTaxSavingsEur)})`
          )
          .join('; ');
        lines.push(`- **Ejecutable HOY sin bloqueo:** ${todayList}`);
      }

      if (optimizationPlan.executableInYearWindow.length > 0) {
        const windowList = optimizationPlan.executableInYearWindow
          .map(
            (s) =>
              `${s.name} (${s.ticker}): vender ${s.qtyToSell} uds desde ${s.recommendedExecutionDate} (${formatEUR(s.estimatedGainLossEur)})`
          )
          .join('; ');
        lines.push(`- **En ventana libre antes del 31/12/${fiscalYear}:** ${windowList}`);
      }

      if (optimizationPlan.fullLiquidationAlternatives.length > 0) {
        const fullList = optimizationPlan.fullLiquidationAlternatives
          .map((s) => `${s.name} (${s.ticker}): liquidar el 100% (${s.totalOpenQty} uds → ${formatEUR(s.estimatedGainLossEur)})`)
          .join('; ');
        lines.push(`- **Alternativa liquidación 100% HOY (sin recomprar en 2 meses):** ${fullList}`);
      }

      if (optimizationPlan.postSaleWarning) {
        lines.push(`- **Aviso Regla 2 meses:** ${optimizationPlan.postSaleWarning}`);
      }

      const content = lines.join('\n');
      return { content, spokenText: cleanTextForSpeech(content) };
    } catch (err) {
      console.warn('Error ejecutando motor FIFO en modo local:', err);
    }
  }

  // 1. Consulta por un año concreto (2018 - 2026)
  const yearMatch = q.match(/\b(2018|2019|2020|2021|2022|2023|2024|2025|2026)\b/);
  if (yearMatch) {
    const yr = Number(yearMatch[1]);
    const yData = chartsData.yearly.find((y) => y.year === yr);
    const divYear = dividendsData.annualSummary.find((d) => d.year === String(yr));
    if (yData) {
      const bestMonth = [...yData.months].sort((a, b) => b.netPnl - a.netPnl)[0];
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const content =
        `**Resumen auditado del año ${yr} (DEGIRO):**\n` +
        `- **Resultado neto realizado:** ${yData.netPnl >= 0 ? '+' : ''}${formatEUR(yData.netPnl)} (${yData.roiPct >= 0 ? '+' : ''}${yData.roiPct.toFixed(2)}% ROI)\n` +
        `- **Operaciones:** ${yData.trades} órdenes ejecutadas\n` +
        `- **Comisiones pagadas:** ${formatEUR(yData.fees)}\n` +
        `- **Mejor mes:** ${monthNames[(bestMonth?.m || 1) - 1]} (${bestMonth.netPnl >= 0 ? '+' : ''}${formatEUR(bestMonth.netPnl)})\n` +
        (divYear ? `- **Dividendos netos cobrados:** ${formatEUR(divYear.net)} en ${divYear.count} pagos` : '');
      return { content, spokenText: cleanTextForSpeech(content) };
    }
  }

  // 2. Búsqueda de posición específica por nombre o ticker
  const matchedPos: PositionItem | undefined = portfolioState.positions.find((p) => {
    const pName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const pTicker = p.ticker.toLowerCase();
    const words = pName.split(/\s+/).filter((w) => w.length >= 4);
    return (
      (pTicker.length >= 2 && q.includes(pTicker)) ||
      words.some((w) => !['etf', 'ucits', 'daily', 'shares', 'class', 'corp', 'corporation'].includes(w) && q.includes(w))
    );
  });

  if (matchedPos && !q.includes('cartera') && !q.includes('resumen')) {
    const content =
      `**Análisis de ${matchedPos.name} (${matchedPos.ticker}):**\n` +
      `- **Posición actual:** ${matchedPos.shares} títulos valorados en **${formatEUR(matchedPos.totalValue)}**\n` +
      `- **Precio actual vs medio:** ${matchedPos.currentPrice.toFixed(2)} ${matchedPos.currency} (comprado a ${matchedPos.avgPrice.toFixed(2)})\n` +
      `- **Variación hoy:** ${matchedPos.dailyChangeValue >= 0 ? '+' : ''}${formatEUR(matchedPos.dailyChangeValue)} (${matchedPos.dailyChangePct >= 0 ? '+' : ''}${matchedPos.dailyChangePct.toFixed(2)}%)\n` +
      `- **Resultado acumulado:** ${matchedPos.unrealizedGainLoss >= 0 ? '+' : ''}${formatEUR(matchedPos.unrealizedGainLoss)} (${matchedPos.unrealizedGainLossPct >= 0 ? '+' : ''}${matchedPos.unrealizedGainLossPct.toFixed(2)}%)`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 3. Dividendos
  if (q.includes('dividendo')) {
    const content =
      `**Auditoría de Dividendos de Domingo (2018–2026):**\n` +
      `- **Total neto ingresado:** **${formatEUR(dividendsData.totalHistoricalNet)}** en ${dividendsData.totalPaymentsCount} cobros\n` +
      `- **Total bruto:** ${formatEUR(dividendsData.totalHistoricalGross)} (retenciones: ${formatEUR(dividendsData.totalHistoricalTaxes)})\n` +
      `- **Últimos años:** 2024 (${formatEUR(70.56)} netos) · 2025 (${formatEUR(14.26)} netos) · 2026 (${formatEUR(2.16)} netos)`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 4. Comisiones y tarifas
  if (q.includes('comision') || q.includes('tarifa') || q.includes('coste') || q.includes('etf gratis')) {
    const totalFees = portfolioState.tradingAnalytics?.totalFeesPaid ?? 7200.45;
    const content =
      `**Comisiones y Tarifas de tus Brokers:**\n` +
      `- **Comisiones históricas DEGIRO (2018–2026):** **${formatEUR(totalFees)}** en ${portfolioState.tradingAnalytics?.totalTrades ?? 2847} operaciones (en 2026 llevas ${formatEUR(363)}).\n` +
      `- **Tarifas actuales:** DEGIRO cobra 2 € en España/EE.UU., 4,90 € en XETRA/Tradegate y tienes **${coreEtfsCount} ETFs Core Selection a 1 €**.\n` +
      `- **MyInvestor:** 0 € de comisión en fondos indexados y 0,12% (mín. 3 €) en acciones y ETFs.`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 5. Meta / Objetivo
  if (q.includes('meta') || q.includes('objetivo') || q.includes('falta')) {
    const lines = perPortfolio
      .map((p) => {
        const pct = p.goal > 0 ? Math.min(100, Math.round((p.totalVal / p.goal) * 100)) : 0;
        const rem = Math.max(0, p.goal - p.totalVal);
        return `- **${p.port.name}:** ${formatEUR(p.totalVal)} de ${formatEUR(p.goal)} (**${pct}%**${rem === 0 ? ' · ¡Meta lograda!' : `, faltan ${formatEUR(rem)}`})`;
      })
      .join('\n');
    const content = `**Estado de tus Metas por Cartera:**\n${lines}`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 6. Mejores / peores / ganadores / perdedores / histórico por años
  if (q.includes('ganador') || q.includes('mejor') || q.includes('peor') || q.includes('perdedor') || q.includes('historico') || q.includes('anos')) {
    const topW = chartsData.topWinners.slice(0, 3).map((w) => `${w.name} (+${formatEUR(w.netPnl)})`).join(', ');
    const topL = chartsData.topLosers.slice(0, 2).map((l) => `${l.name} (${formatEUR(l.netPnl)})`).join(' y ');
    const content =
      `**Balance Histórico DEGIRO (2018–2026):**\n` +
      `- **Mejores años:** 2024 (**+${formatEUR(26893.61)}**, +61,5% ROI), 2025 (**+${formatEUR(9488.6)}**) y 2026 (**+${formatEUR(3296.69)}**).\n` +
      `- **Mayores ganadores:** ${topW}.\n` +
      `- **Mayores minusvalías cerradas:** ${topL}.`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 7. Riesgo / diversificación / análisis profundo
  if (q.includes('riesgo') || q.includes('diversifica') || q.includes('concentra') || q.includes('analiza') || q.includes('consejo')) {
    const sorted = [...activeStats.positions].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0));
    const top3 = sorted.slice(0, 3);
    const top3Weight =
      activeStats.posVal > 0
        ? ((top3.reduce((s, p) => s + (p.totalValue || 0), 0) / activeStats.posVal) * 100).toFixed(1)
        : '0';
    const cryptoExposure = activeStats.positions
      .filter((p) => p.type === 'Cripto')
      .reduce((s, p) => s + (p.totalValue || 0), 0);
    const cryptoPct = activeStats.posVal > 0 ? ((cryptoExposure / activeStats.posVal) * 100).toFixed(1) : '0';

    const content =
      `**Diagnóstico de Riesgo y Concentración (${activeStats.port.name}):**\n` +
      `- **Valor total:** **${formatEUR(activeStats.totalVal)}** (${activeStats.positions.length} posiciones abiertas y ${formatEUR(activeStats.cash)} en liquidez).\n` +
      `- **Concentración Top 3:** Tus 3 mayores posiciones (${top3.map((p) => p.name).join(', ') || 'ninguna'}) concentran el **${top3Weight}%** del capital invertido.\n` +
      `- **Exposición Cripto/ETPs:** ${formatEUR(cryptoExposure)} (**${cryptoPct}%** de la cartera).\n` +
      `- *Nota:* Activa tu clave gratuita de **Gemini** arriba en el icono de llave para pedir análisis estratégicos abiertos y simulaciones a medida.`;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 8. Carteras concretas (MyInvestor, Coinbase, Bitvavo, BBVA, DEGIRO) o listado de todas
  if (q.includes('coinbase') || q.includes('bitvavo') || q.includes('bbva') || q.includes('myinvestor') || q.includes('carteras')) {
    const breakdown = perPortfolio
      .map(
        (p) =>
          `- **${p.port.name}:** **${formatEUR(p.totalVal)}** (${p.positions.length} pos. abiertas · Efectivo: ${formatEUR(p.cash)})`
      )
      .join('\n');
    const content =
      `**Resumen de tus ${perPortfolio.length} Carteras, Domingo:**\n` +
      `- **Patrimonio Global Consolidado:** **${formatEUR(totalGlobal)}** (Liquidez total: ${formatEUR(totalCashGlobal)})\n` +
      breakdown;
    return { content, spokenText: cleanTextForSpeech(content) };
  }

  // 9. Respuesta general por defecto: cómo va hoy el portafolio
  const topToday = [...activeStats.positions].sort((a, b) => (b.dailyChangeValue || 0) - (a.dailyChangeValue || 0))[0];
  const content =
    `**Hola Domingo, así está tu patrimonio ahora mismo:**\n` +
    `- **Patrimonio Total Consolidado:** **${formatEUR(totalGlobal)}** (Variación hoy: ${totalDayGlobal >= 0 ? '+' : ''}${formatEUR(totalDayGlobal)})\n` +
    `- **Cartera activa (${activeStats.port.name}):** **${formatEUR(activeStats.totalVal)}** (${formatEUR(activeStats.posVal)} invertidos + ${formatEUR(activeStats.cash)} en efectivo)\n` +
    `- **Beneficio Total DEGIRO:** ${activeStats.totalBp >= 0 ? '+' : ''}${formatEUR(activeStats.totalBp)}\n` +
    (topToday
      ? `- **Activo más destacado hoy:** ${topToday.name} (${topToday.dailyChangeValue >= 0 ? '+' : ''}${formatEUR(topToday.dailyChangeValue)}, ${topToday.dailyChangePct >= 0 ? '+' : ''}${topToday.dailyChangePct.toFixed(2)}%)`
      : '');

  return { content, spokenText: cleanTextForSpeech(content) };
}

/**
 * Valida en directo si una API Key gratuita de Google AI Studio es válida.
 */
export async function validateGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { valid: false, error: 'Introduce una clave primero.' };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
    );
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Código HTTP ${res.status}`;
      return { valid: false, error: `Clave no válida: ${msg}` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Error de red al verificar con Google.' };
  }
}

/**
 * Contexto ultracompacto (<580 caracteres) con las cifras reales en vivo de Domingo
 * para el motor IA en la nube sin clave (0 €, sin configuración).
 */
function buildCompactCloudContext(portfolioState: PortfolioState): string {
  const defaultId = portfolioState.portfolios[0]?.id || 'port-main';
  const active =
    portfolioState.portfolios.find((p) => p.id === portfolioState.activePortfolioId) ||
    portfolioState.portfolios[0];
  const activePos = portfolioState.positions.filter(
    (p) => (p.portfolioId || defaultId) === active?.id
  );
  const posVal = activePos.reduce((s, p) => s + (p.totalValue || 0), 0);
  const cash =
    active?.id === defaultId
      ? active?.cash !== undefined
        ? active.cash
        : portfolioState.cash
      : active?.cash ?? 0;
  const totalVal = posVal + cash;
  const dayBp = activePos.reduce((s, p) => s + (p.dailyChangeValue || 0), 0);
  const topHoldings = [...activePos]
    .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
    .slice(0, 5)
    .map((p) => `${p.ticker}:${Math.round(p.totalValue)}€(${p.dailyChangePct >= 0 ? '+' : ''}${p.dailyChangePct.toFixed(1)}%)`)
    .join(', ');

  return (
    `Asistente financiero por voz de Domingo en España. Responde en español claro, directo y sin tablas Markdown. ` +
    `Carteras: DEGIRO, MyInvestor, Coinbase, Bitvavo, BBVA. ` +
    `Activa(${active?.name || 'DEGIRO'}): ${totalVal.toFixed(0)}€ (${posVal.toFixed(0)}€ inv + ${cash.toFixed(0)}€ efec), hoy ${dayBp >= 0 ? '+' : ''}${dayBp.toFixed(0)}€. ` +
    `Top: ${topHoldings || 'sin pos'}. Hist DEGIRO 2018-26: +21989€ cerrados, div 533€.`
  ).slice(0, 560);
}

/**
 * Motor IA Generativo en la Nube SIN CLAVE (0 €, responde a cualquier pregunta abierta).
 */
async function askZeroKeyCloudAI(
  userMessage: string,
  history: AssistantChatMessage[],
  portfolioState: PortfolioState
): Promise<string | null> {
  const compactSystem = buildCompactCloudContext(portfolioState);
  const lastTurn = history
    .filter((m) => m.id !== 'welcome-domingo')
    .slice(-2)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content.slice(0, 140),
    }));

  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [
          { role: 'system', content: compactSystem },
          ...lastTurn,
          { role: 'user', content: userMessage.slice(0, 350) },
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) return reply;
    }
  } catch {
    // probar respaldo GET directo
  }

  try {
    const promptUrl = `https://text.pollinations.ai/${encodeURIComponent(
      `${compactSystem}\nUsuario: ${userMessage.slice(0, 300)}`
    )}`;
    const getRes = await fetch(promptUrl);
    if (getRes.ok) {
      const plain = (await getRes.text()).trim();
      if (plain && !plain.startsWith('<!DOCTYPE')) return plain;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Envía la pregunta de Domingo a Gemini (si hay clave) o a la IA en la nube gratuita sin clave,
 * dejando el motor estático solo si no hay conexión a internet.
 */
export async function askDomingoAssistant(params: {
  userMessage: string;
  history: AssistantChatMessage[];
  portfolioState: PortfolioState;
  lastUpdatedTime?: string;
}): Promise<{
  content: string;
  spokenText: string;
  source: 'gemini' | 'local';
  modelUsed: string;
}> {
  const { userMessage, history, portfolioState, lastUpdatedTime } = params;
  const apiKey = (portfolioState.geminiApiKey || getStoredGeminiApiKey()).trim();

  if (apiKey) {
    const preferredModel = getStoredGeminiModel();
    const fallbackOrder: GeminiModelChoice[] = Array.from(
      new Set<GeminiModelChoice>([
        preferredModel,
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
      ])
    );

    const systemContext = buildDomingoPortfolioContext(portfolioState, lastUpdatedTime);
    const recentTurns = history
      .filter((m) => m.id !== 'welcome-domingo')
      .slice(-10)
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

    const contents = [
      ...recentTurns,
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ];

    for (const model of fallbackOrder) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemContext }],
              },
              contents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 4096,
              },
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 429 || response.status === 404 || response.status === 503) {
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const parts: Array<{ text?: string; thought?: boolean }> =
          data?.candidates?.[0]?.content?.parts || [];
        const visibleParts = parts.filter((p) => !p.thought);
        const text: string = (visibleParts.length > 0 ? visibleParts : parts)
          .map((p) => p.text || '')
          .join('')
          .trim();

        if (text) {
          return {
            content: text,
            spokenText: cleanTextForSpeech(text),
            source: 'gemini',
            modelUsed: model,
          };
        }
      } catch (err) {
        console.warn(`Aviso al consultar ${model}, probando alternativa:`, err);
      }
    }
  }

  // Motor IA en la Nube Gratuito SIN CLAVE (responde a cualquier pregunta abierta sin configurar nada)
  const cloudReply = await askZeroKeyCloudAI(userMessage, history, portfolioState);
  if (cloudReply) {
    return {
      content: cloudReply,
      spokenText: cleanTextForSpeech(cloudReply),
      source: 'gemini',
      modelUsed: 'IA en Nube Gratis (Sin Clave)',
    };
  }

  // Último respaldo offline si el móvil no tiene internet
  const localFallback = answerWithLocalAnalyst(userMessage, portfolioState);
  return {
    content: localFallback.content,
    spokenText: localFallback.spokenText,
    source: 'local',
    modelUsed: 'Modo Sin Conexión',
  };
}
