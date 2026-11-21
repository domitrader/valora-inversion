import { PositionItem, PortfolioSummary, ParsedPositionRow, AssetType } from '../types/portfolio';

/**
 * Formatea un número en euros respetando la puntuación española (punto para miles, coma para decimales).
 * Si hideFigures es true, devuelve una máscara de privacidad.
 */
export function formatEUR(value: number, hideFigures: boolean = false, showSign: boolean = false): string {
  if (hideFigures) {
    return '••••••';
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Formateo con 2 decimales usando formato es-ES
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absValue);

  const sign = isNegative ? '-' : showSign && value > 0 ? '+' : '';
  return `${sign}${formatted} €`;
}

/**
 * Formatea el valor grande de mercado con el símbolo euro al frente y separación de decimales
 * como en la cabecera principal de la app (ej: €15.046,85).
 */
export function formatHeaderEUR(value: number, hideFigures: boolean = false): { integerPart: string; decimalPart: string; sign: string } {
  if (hideFigures) {
    return { integerPart: '••••', decimalPart: '••', sign: '' };
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const parts = absValue.toFixed(2).split('.');
  const integerFormatted = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 0,
  }).format(parseInt(parts[0], 10));

  return {
    sign: isNegative ? '-' : '',
    integerPart: integerFormatted,
    decimalPart: parts[1] || '00',
  };
}

/**
 * Formatea porcentajes con coma decimal y signo + o - (ej: +2,48 %, -9,65 %).
 */
export function formatPercent(pct: number, includeSign: boolean = true): string {
  if (isNaN(pct) || !isFinite(pct)) return '0,00 %';

  const isNegative = pct < 0;
  const absPct = Math.abs(pct);
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absPct);

  if (!includeSign) {
    return `${formatted} %`;
  }

  const sign = isNegative ? '-' : pct > 0 ? '+' : '';
  return `${sign}${formatted} %`;
}

/**
 * Formato genérico para cualquier divisa soportada
 */
export function formatCurrency(value: number, currency: string = 'EUR', hideFigures: boolean = false): string {
  if (hideFigures) return '••••••';
  
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  const sign = value < 0 ? '-' : '';
  return currency === 'USD' ? `${sign}${symbol}${formatted}` : `${sign}${formatted} ${symbol}`;
}

/**
 * Calcula las métricas globales de la cartera a partir de las posiciones y el efectivo disponible.
 */
export function calculatePortfolioMetrics(positions: PositionItem[], cash: number = 0): PortfolioSummary {
  let totalMarketValue = 0;
  let totalCostBasis = 0;
  let dailyChangeValue = 0;
  let annualProjectedDividends = 0;

  for (const pos of positions) {
    const posValue = pos.shares * pos.currentPrice;
    const posCost = pos.shares * pos.avgPrice;
    
    totalMarketValue += posValue;
    totalCostBasis += posCost;
    dailyChangeValue += pos.dailyChangeValue;

    if (pos.annualDividendPerShare) {
      annualProjectedDividends += pos.shares * pos.annualDividendPerShare;
    } else if (pos.dividendYield) {
      annualProjectedDividends += posValue * (pos.dividendYield / 100);
    }
  }

  const unrealizedGainLoss = totalMarketValue - totalCostBasis;
  const unrealizedGainLossPct = totalCostBasis > 0 ? (unrealizedGainLoss / totalCostBasis) * 100 : 0;

  const previousDayValue = totalMarketValue - dailyChangeValue;
  const dailyChangePct = previousDayValue > 0 ? (dailyChangeValue / previousDayValue) * 100 : 0;

  const monthlyAverageDividends = annualProjectedDividends / 12;
  const dividendYieldPct = totalMarketValue > 0 ? (annualProjectedDividends / totalMarketValue) * 100 : 0;

  return {
    totalMarketValue,
    totalCostBasis,
    dailyChangeValue,
    dailyChangePct,
    unrealizedGainLoss,
    unrealizedGainLossPct,
    annualProjectedDividends,
    monthlyAverageDividends,
    dividendYieldPct,
  };
}

/**
 * Parsea un número en formato español (1.234,56) o internacional (1234.56)
 */
export function parseNumberString(input: string | undefined): number {
  if (!input) return 0;
  let clean = input.trim().replace(/€|\$|£|%/g, '').trim();
  
  // Si contiene coma y punto, determinar cuál es decimal
  if (clean.includes('.') && clean.includes(',')) {
    if (clean.indexOf('.') < clean.indexOf(',')) {
      // Formato europeo: 1.234,56
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano con comas: 1,234.56
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Solo coma -> es separador decimal
    clean = clean.replace(',', '.');
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Detecta automáticamente el tipo de activo según el nombre o ticker
 */
export function detectAssetType(ticker: string, name: string): AssetType {
  const upperTicker = ticker.toUpperCase();
  const upperName = name.toUpperCase();

  const cryptoKeywords = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'BITCOIN', 'ETHEREUM', 'SOLANA', 'CRIPTO', 'CRYPTO', 'ETP', 'ETN'];
  const etfKeywords = ['ETF', 'UCITS', 'ISHARES', 'VANGUARD', 'SPDR', 'XTRACKERS', 'AMUNDI', 'WISDOMTREE', 'INVESCO', 'INDEX'];

  if (cryptoKeywords.some(k => upperTicker.includes(k) || upperName.includes(k))) {
    // Si contiene ETF/ETN/ETP suele ser tracker cripto o directamente cripto
    if (upperTicker.includes('BTC') || upperTicker.includes('ETH') || upperName.includes('BITCOIN') || upperName.includes('CRIPTO')) {
      return 'Cripto';
    }
  }

  if (etfKeywords.some(k => upperTicker.includes(k) || upperName.includes(k))) {
    return 'ETFs';
  }

  return 'Acciones';
}

/**
 * Parser/importador compatible con exportaciones CSV o texto copiado de brokers (DEGIRO, Interactive Brokers, Trade Republic, MyInvestor).
 * Acepta líneas con formato:
 * Nombre/Ticker, ISIN, Cantidad, Precio de compra, Precio actual [, Tipo]
 * o encabezados comunes de DEGIRO.
 */
export function parsePositionsImport(rawText: string): {
  rows: ParsedPositionRow[];
  totalParsed: number;
  validCount: number;
  invalidCount: number;
} {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rows: ParsedPositionRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Descartar encabezados comunes
    const lower = line.toLowerCase();
    if (
      (lower.includes('producto') || lower.includes('nombre') || lower.includes('ticker') || lower.includes('símbolo')) &&
      (lower.includes('isin') || lower.includes('cantidad') || lower.includes('precio'))
    ) {
      continue;
    }

    // Separadores compatibles: punto y coma (;), tabulador (\t) o coma (,)
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes(';')) {
      parts = line.split(';');
    } else if (line.includes(',')) {
      // Manejar comas cuidando si hay números decimales con comas
      // Si hay más de 4 comas, intentar discernir
      parts = line.split(',');
    } else {
      parts = line.split(/\s{2,}/); // Múltiples espacios
    }

    parts = parts.map(p => p.trim());

    if (parts.length < 3) {
      continue;
    }

    // Identificación de campos heurística
    let name = parts[0] || 'Activo';
    let ticker = '';
    let isin = '';
    let shares = 0;
    let avgPrice = 0;
    let currentPrice = 0;
    let type: AssetType = 'Acciones';

    // Heurística de detección
    if (parts.length >= 5) {
      // Formato: Nombre, Ticker/ISIN, Cantidad, Precio Compra, Precio Actual
      name = parts[0];
      const secondField = parts[1];
      if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(secondField)) {
        isin = secondField;
        ticker = parts[0].slice(0, 5).toUpperCase();
      } else {
        ticker = secondField;
      }

      shares = parseNumberString(parts[2]);
      avgPrice = parseNumberString(parts[3]);
      currentPrice = parseNumberString(parts[4]);

      if (parts[5]) {
        const t = parts[5].toLowerCase();
        if (t.includes('etf')) type = 'ETFs';
        else if (t.includes('cripto') || t.includes('crypto')) type = 'Cripto';
        else type = 'Acciones';
      } else {
        type = detectAssetType(ticker, name);
      }
    } else if (parts.length === 4) {
      // Formato: Ticker/Nombre, Cantidad, Precio Compra, Precio Actual
      name = parts[0];
      ticker = parts[0].slice(0, 6).toUpperCase();
      shares = parseNumberString(parts[1]);
      avgPrice = parseNumberString(parts[2]);
      currentPrice = parseNumberString(parts[3]);
      type = detectAssetType(ticker, name);
    } else if (parts.length === 3) {
      // Formato simplificado: Ticker, Cantidad, Precio Compra (asume precio actual = precio compra)
      name = parts[0];
      ticker = parts[0].toUpperCase();
      shares = parseNumberString(parts[1]);
      avgPrice = parseNumberString(parts[2]);
      currentPrice = avgPrice;
      type = detectAssetType(ticker, name);
    }

    const isValid = shares > 0 && avgPrice >= 0;
    let errorMessage = undefined;
    if (!isValid) {
      errorMessage = 'Cantidad debe ser superior a 0 y precio válido';
    }

    rows.push({
      name,
      ticker: ticker || name.slice(0, 4).toUpperCase(),
      isin: isin || undefined,
      type,
      shares,
      avgPrice,
      currentPrice: currentPrice > 0 ? currentPrice : avgPrice,
      isValid,
      errorMessage,
    });
  }

  return {
    rows,
    totalParsed: rows.length,
    validCount: rows.filter(r => r.isValid).length,
    invalidCount: rows.filter(r => !r.isValid).length,
  };
}

/**
 * Genera una serie de sparkline aleatoria pero con tendencia controlada
 */
export function generateSampleSparkline(changePct: number, pointsCount: number = 20): number[] {
  const points: number[] = [100];
  const trend = changePct / pointsCount;
  
  for (let i = 1; i < pointsCount; i++) {
    const randomVariation = (Math.random() - 0.48) * 1.5;
    const nextVal = Math.max(10, points[i - 1] + trend + randomVariation);
    points.push(Number(nextVal.toFixed(2)));
  }

  return points;
}
