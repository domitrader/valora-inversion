import { AssetType, PositionItem } from '../types/portfolio';
import { generateSampleSparkline } from './calculations';

export interface BrokerImportResult {
  detectedBroker: 'DEGIRO' | 'MyInvestor' | 'Trade Republic' | 'Genérico';
  delimiter: string;
  totalLines: number;
  detectedCash?: number;
  parsedPositions: PositionItem[];
  invalidLines: { line: number; rawText: string; reason: string }[];
  summary: {
    totalValue: number;
    totalCost: number;
    count: number;
  };
}

/**
 * Limpia y normaliza cadenas numéricas financieras (formato español 1.234,56 € o internacional 1,234.56).
 * Soporta números negativos entre paréntesis como "(120,50)" y símbolos de moneda.
 */
export function sanitizeFinancialNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;

  let str = String(val).trim();
  if (!str) return 0;

  // Manejar negativos entre paréntesis ej: "(150,20)"
  const isParenNegative = /^\(.*\)$/.test(str);
  str = str.replace(/[()€$£%\s]/g, '').trim();

  // Si tiene signo menos al final: ej "150,20-"
  const isTrailingNegative = str.endsWith('-');
  if (isTrailingNegative) {
    str = str.slice(0, -1);
  }

  // Detección de puntuación decimal
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // 1.234,56 (formato español/europeo)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 (formato anglosajón)
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // 1234,56 -> 1234.56
    str = str.replace(',', '.');
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (isParenNegative || isTrailingNegative) num = -Math.abs(num);
  return num;
}

/**
 * Detecta el delimitador de un CSV inspeccionando las primeras líneas.
 */
export function detectCsvDelimiter(text: string): string {
  const sampleLines = text.split(/\r?\n/).slice(0, 5).filter(l => l.trim().length > 0);
  if (sampleLines.length === 0) return ',';

  const counts: Record<string, number> = { '\t': 0, ';': 0, ',': 0, '|': 0 };
  for (const line of sampleLines) {
    counts['\t'] += (line.match(/\t/g) || []).length;
    counts[';'] += (line.match(/;/g) || []).length;
    counts[','] += (line.match(/,/g) || []).length;
    counts['|'] += (line.match(/\|/g) || []).length;
  }

  let bestDelimiter = ',';
  let maxCount = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delim;
    }
  }
  return bestDelimiter;
}

/**
 * Parsea una línea de CSV respetando valores entre comillas dobles.
 */
export function splitCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // escapar comilla doble
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Infiere el tipo de activo a partir del ISIN, Ticker y Nombre
 */
export function inferAssetType(name: string, ticker: string, isin?: string): AssetType {
  const upper = `${name} ${ticker} ${isin || ''}`.toUpperCase();

  // Criptomonedas / ETPs cripto
  if (
    upper.includes('BITCOIN') ||
    upper.includes('BTC') ||
    upper.includes('ETHEREUM') ||
    upper.includes('ETH') ||
    upper.includes('SOLANA') ||
    upper.includes('SOL') ||
    upper.includes('21SHARES') ||
    upper.includes('VANECK BIT')
  ) {
    return 'Cripto';
  }

  // ETFs & Fondos Indexados
  if (
    upper.includes('ETF') ||
    upper.includes('UCITS') ||
    upper.includes('ISHARES') ||
    upper.includes('VANGUARD') ||
    upper.includes('AMUNDI') ||
    upper.includes('XTRACKERS') ||
    upper.includes('SPDR') ||
    upper.includes('WISDOMTREE') ||
    upper.includes('INDEX') ||
    upper.includes('FONDO')
  ) {
    return 'ETFs';
  }

  return 'Acciones';
}

/**
 * Asigna una bandera de país según el ISIN
 */
export function inferCountryFlagFromIsin(isin?: string): string {
  if (!isin || isin.length < 2) return '🌐';
  const prefix = isin.slice(0, 2).toUpperCase();
  const flagMap: Record<string, string> = {
    ES: '🇪🇸',
    US: '🇺🇸',
    IE: '🇮🇪',
    LU: '🇱🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    NL: '🇳🇱',
    GB: '🇬🇧',
    CH: '🇨🇭',
    IT: '🇮🇹',
    JE: '🇯🇪',
    SE: '🇸🇪',
  };
  return flagMap[prefix] || '🌐';
}

/**
 * Motor central de importación financiera adaptado para DEGIRO, MyInvestor y brokers globales.
 */
export function parseBrokerExport(rawText: string): BrokerImportResult {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const delimiter = detectCsvDelimiter(rawText);

  if (lines.length === 0) {
    return {
      detectedBroker: 'Genérico',
      delimiter,
      totalLines: 0,
      parsedPositions: [],
      invalidLines: [],
      summary: { totalValue: 0, totalCost: 0, count: 0 },
    };
  }

  // Detectar formato de broker a partir de las cabeceras
  const headerLine = lines[0].toLowerCase();
  let detectedBroker: BrokerImportResult['detectedBroker'] = 'Genérico';

  if (headerLine.includes('degiro') || (headerLine.includes('producto') && (headerLine.includes('isin') || headerLine.includes('símbolo')))) {
    detectedBroker = 'DEGIRO';
  } else if (headerLine.includes('myinvestor') || headerLine.includes('títulos/participaciones') || headerLine.includes('importe invertido')) {
    detectedBroker = 'MyInvestor';
  } else if (headerLine.includes('trade republic') || (headerLine.includes('shares') && headerLine.includes('avg buy price'))) {
    detectedBroker = 'Trade Republic';
  }

  // Mapear índices de columnas dinámicamente si hay cabecera
  const headers = splitCsvRow(lines[0], delimiter).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  let colName = -1;
  let colTicker = -1;
  let colIsin = -1;
  let colShares = -1;
  let colAvgPrice = -1;
  let colCurrentPrice = -1;
  let colTotalValue = -1;
  let colType = -1;

  headers.forEach((h, idx) => {
    if (h.includes('producto') || h.includes('nombre') || h.includes('product') || h.includes('name') || h.includes('instrument')) {
      if (colName === -1) colName = idx;
    }
    if (h.includes('símbolo') || h.includes('simbolo') || h.includes('ticker') || h.includes('symbol')) {
      colTicker = idx;
    }
    if (h.includes('isin')) {
      colIsin = idx;
    }
    if (h.includes('cantidad') || h.includes('títulos') || h.includes('titulos') || h.includes('participaciones') || h.includes('quantity') || h.includes('shares') || h.includes('número')) {
      colShares = idx;
    }
    if (h.includes('compra') || h.includes('precio medio') || h.includes('avg buy') || h.includes('cost basis') || h.includes('precio de compra')) {
      colAvgPrice = idx;
    }
    if (h.includes('precio actual') || h.includes('cotización') || h.includes('cotizacion') || h.includes('último precio') || h.includes('current price') || h.includes('close price')) {
      colCurrentPrice = idx;
    }
    if (h.includes('valor en eur') || h.includes('valoración actual') || h.includes('total value') || h.includes('valor')) {
      colTotalValue = idx;
    }
    if (h.includes('tipo') || h.includes('asset class') || h.includes('categoría')) {
      colType = idx;
    }
  });

    let detectedCash: number | undefined = undefined;
    const groupedMap = new Map<string, PositionItem>();
    const invalidLines: BrokerImportResult['invalidLines'] = [];

    // Empezar desde la línea 1 si la línea 0 era cabecera
    const hasHeader = colName !== -1 || colShares !== -1 || colIsin !== -1 || headerLine.includes('producto') || headerLine.includes('nombre');
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const rawLine = lines[i];
      const cells = splitCsvRow(rawLine, delimiter);

      if (cells.length < 2) continue;

      try {
        let name = '';
        let ticker = '';
        let isin = '';
        let shares = 0;
        let avgPrice = 0;
        let currentPrice = 0;
        let type: AssetType = 'Acciones';

        if (hasHeader && colName !== -1) {
          name = cells[colName] || '';
          ticker = colTicker !== -1 ? cells[colTicker] : '';
          isin = colIsin !== -1 ? cells[colIsin] : '';
          shares = colShares !== -1 ? sanitizeFinancialNumber(cells[colShares]) : 0;
          avgPrice = colAvgPrice !== -1 ? sanitizeFinancialNumber(cells[colAvgPrice]) : 0;
          currentPrice = colCurrentPrice !== -1 ? sanitizeFinancialNumber(cells[colCurrentPrice]) : 0;
          if (colType !== -1 && cells[colType]) {
            const t = cells[colType].toLowerCase();
            if (t.includes('etf') || t.includes('fondo')) type = 'ETFs';
            else if (t.includes('cripto') || t.includes('crypto')) type = 'Cripto';
          }
        } else {
          // Fallback posicional inteligente:
          // Nombre, Ticker/ISIN, Cantidad, Precio Compra, Precio Actual
          name = cells[0];
          const second = cells[1] || '';
          if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(second)) {
            isin = second;
          } else {
            ticker = second;
          }

          shares = sanitizeFinancialNumber(cells[2]);
          avgPrice = sanitizeFinancialNumber(cells[3]);
          currentPrice = sanitizeFinancialNumber(cells[4] || cells[3]);
        }

        // 1. Detección de fila de efectivo / liquidez (ej: CASH & CASH FUND & FTX CASH)
        const upperName = name.toUpperCase();
        if (upperName.includes('CASH') || upperName.includes('EFECTIVO') || upperName.includes('LIQUIDEZ') || upperName.includes('FONDO MONETARIO')) {
          const cashVal = colTotalValue !== -1 && cells[colTotalValue]
            ? sanitizeFinancialNumber(cells[colTotalValue])
            : sanitizeFinancialNumber(cells[cells.length - 1]);
          if (cashVal > 0) {
            detectedCash = (detectedCash || 0) + cashVal;
          }
          continue;
        }

        // Validar datos mínimos obligatorios
        if (!name) {
          invalidLines.push({ line: i + 1, rawText: rawLine, reason: 'Falta nombre del activo' });
          continue;
        }
        if (shares <= 0) {
          invalidLines.push({ line: i + 1, rawText: rawLine, reason: `Cantidad inválida: ${shares}` });
          continue;
        }
        if (avgPrice <= 0 && currentPrice <= 0) {
          invalidLines.push({ line: i + 1, rawText: rawLine, reason: 'Precios de cotización o compra nulos' });
          continue;
        }

        if (currentPrice <= 0) currentPrice = avgPrice;
        if (avgPrice <= 0) avgPrice = currentPrice;

        // Inferencia de ticker e ISIN si vienen juntos (formato DEGIRO "AAPL | US0378331005")
        if (ticker.includes('|') || ticker.includes('/')) {
          const parts = ticker.split(/[/|]/).map(p => p.trim());
          ticker = parts[0];
          if (parts[1] && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(parts[1])) {
            isin = parts[1];
          }
        }

        // Asignación de tickers reconocidos para productos populares
        if (!ticker || ticker.length <= 1) {
          if (upperName.includes('GOLD 3X') || isin === 'IE00B8HGT870') {
            ticker = '3GOL';
          } else if (upperName.includes('NASDAQ 100 3X') || isin === 'IE00BLRPRL42') {
            ticker = 'QQQ3';
          } else if (upperName.includes('21SHARES BITCOIN') || isin === 'CH0454664001') {
            ticker = '2BTC';
          } else if (upperName.includes('VANECK BITCOIN') || isin === 'DE000A28M8D0') {
            ticker = 'VBTC';
          } else {
            ticker = isin ? isin.slice(0, 6) : name.slice(0, 5).toUpperCase().replace(/\s+/g, '');
          }
        }

        type = inferAssetType(name, ticker, isin);
        const countryFlag = inferCountryFlagFromIsin(isin);

        const totalValue = Number((shares * currentPrice).toFixed(2));
        const totalCost = Number((shares * avgPrice).toFixed(2));
        const unrealizedGainLoss = Number((totalValue - totalCost).toFixed(2));
        const unrealizedGainLossPct = totalCost > 0 ? Number(((unrealizedGainLoss / totalCost) * 100).toFixed(2)) : 0;
        const dailyChangePct = Number(((Math.random() - 0.45) * 3).toFixed(2));
        const dailyChangeValue = Number(((totalValue * dailyChangePct) / 100).toFixed(2));

        // Clave única de consolidación (evitar duplicados por compras en diferentes bolsas como Alemania/LSE)
        const consolidationKey = (isin || ticker || name).toUpperCase().trim();

        if (groupedMap.has(consolidationKey)) {
          // Fusionar con la posición existente calculando el precio medio ponderado exacto
          const existing = groupedMap.get(consolidationKey)!;
          const combinedShares = existing.shares + shares;
          const combinedTotalCost = (existing.shares * existing.avgPrice) + (shares * avgPrice);
          const combinedAvgPrice = combinedShares > 0 ? combinedTotalCost / combinedShares : existing.avgPrice;
          const combinedTotalValue = existing.totalValue + totalValue;
          const combinedCurrentPrice = combinedShares > 0 ? combinedTotalValue / combinedShares : existing.currentPrice;

          existing.shares = combinedShares;
          existing.avgPrice = Number(combinedAvgPrice.toFixed(2));
          existing.currentPrice = Number(combinedCurrentPrice.toFixed(2));
          existing.totalValue = Number(combinedTotalValue.toFixed(2));
          existing.unrealizedGainLoss = Number((existing.totalValue - combinedTotalCost).toFixed(2));
          existing.unrealizedGainLossPct = combinedTotalCost > 0 ? Number(((existing.unrealizedGainLoss / combinedTotalCost) * 100).toFixed(2)) : 0;
          existing.dailyChangeValue = Number(((existing.totalValue * existing.dailyChangePct) / 100).toFixed(2));
        } else {
          groupedMap.set(consolidationKey, {
            id: `imp-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            name,
            ticker,
            isin: isin || undefined,
            type,
            shares,
            avgPrice,
            currentPrice,
            currency: 'EUR',
            market: detectedBroker,
            countryFlag,
            logoBg: type === 'Cripto' ? 'bg-amber-600' : type === 'ETFs' ? 'bg-blue-700' : 'bg-slate-800',
            logoText: ticker.slice(0, 2),
            dailyChangePct,
            dailyChangeValue,
            totalValue,
            unrealizedGainLoss,
            unrealizedGainLossPct,
            sparkline: generateSampleSparkline(dailyChangePct),
          });
        }
      } catch (err: any) {
        invalidLines.push({ line: i + 1, rawText: rawLine, reason: err?.message || 'Error al procesar línea' });
      }
    }

    const parsedPositions = Array.from(groupedMap.values());
    const totalValue = parsedPositions.reduce((acc, p) => acc + p.totalValue, 0);
    const totalCost = parsedPositions.reduce((acc, p) => acc + (p.shares * p.avgPrice), 0);

    return {
      detectedBroker,
      delimiter,
      totalLines: lines.length,
      detectedCash,
      parsedPositions,
      invalidLines,
      summary: {
        totalValue: Number(totalValue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        count: parsedPositions.length,
      },
    };
  }
