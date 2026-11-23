import { PositionItem } from '../types/portfolio';
import { generateSampleSparkline } from '../utils/calculations';
import { COMPREHENSIVE_CATALOG } from '../data/comprehensiveAssetCatalog';

export interface LiveMarketQuote {
  ticker: string;
  priceEUR: number;
  originalPrice: number;
  currency: string;
  changePct: number;
}

/**
 * Servicio de cotizaciones en tiempo real integrado con:
 * - CoinGecko API (criptoactivos en EUR)
 * - Yahoo Finance API (acciones IBEX 35, Reino Unido, Europa, Wall Street y ETFs con conversión EUR/USD/GBP)
 */
export const liveQuotesService = {
  eurUsdRate: 1.085, // Tasa de respaldo
  eurGbpRate: 0.85,  // Tasa de respaldo EUR/GBP
  /**
   * Obtiene la tasa de cambio EUR/USD y EUR/GBP en tiempo real vía TradingView
   */
  async getLiveEurUsdRate(): Promise<number> {
    try {
      const res = await fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          symbols: { tickers: ['FX_IDC:EURUSD', 'FX_IDC:EURGBP'] },
          columns: ['name', 'close'],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of data?.data || []) {
          const rate = Number(r.d?.[1]);
          if (r.s === 'FX_IDC:EURUSD' && rate > 0) this.eurUsdRate = rate;
          if (r.s === 'FX_IDC:EURGBP' && rate > 0) this.eurGbpRate = rate;
        }
        return this.eurUsdRate;
      }
    } catch {
      console.warn('Usando tasa EUR/USD de referencia:', this.eurUsdRate);
    }
    return this.eurUsdRate;
  },

  /**
   * Consulta una cotización individual (vía TradingView Global Scanner y catálogo)
   */
  async fetchStockQuote(symbol: string): Promise<LiveMarketQuote | null> {
    try {
      let cleanSymbol = symbol.split(/[\s/|()]/)[0].trim().toUpperCase();

      // Buscar coincidencia en catálogo
      const catalogMatch = COMPREHENSIVE_CATALOG.find(
        c => c.ticker.toUpperCase() === cleanSymbol || (c.yahooSymbol && c.yahooSymbol.toUpperCase() === cleanSymbol)
      );
      if (catalogMatch?.yahooSymbol) {
        cleanSymbol = catalogMatch.yahooSymbol.split('.')[0];
      }

      // Probar TradingView primero con bolsas comunes
      const candidateTickers = [
        `NASDAQ:${cleanSymbol}`, `NYSE:${cleanSymbol}`,
        `BME:${cleanSymbol}`, `XETR:${cleanSymbol}`,
        `EURONEXT:${cleanSymbol}`, `MIL:${cleanSymbol}`, `LSE:${cleanSymbol}`
      ];
      if (cleanSymbol === 'QQQ3') candidateTickers.unshift('EURONEXT:QQQ3-ETFP');

      const tvRes = await fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          symbols: { tickers: candidateTickers },
          columns: ['name', 'close', 'change', 'currency'],
        }),
      });
      if (tvRes.ok) {
        const data = await tvRes.json();
        const row = (data?.data || []).find((r: any) => Number(r.d?.[1]) > 0);
        if (row) {
          const rawPrice = Number(row.d[1]);
          const changePct = Number(row.d[2] || 0);
          const cur = String(row.d[3] || 'EUR');
          let priceEUR = rawPrice;
          if (cur === 'USD') priceEUR = rawPrice / this.eurUsdRate;
          else if (cur === 'GBP') priceEUR = rawPrice / this.eurGbpRate;
          else if (cur === 'GBX' || cur === 'GBp') priceEUR = (rawPrice / 100) / this.eurGbpRate;

          return {
            ticker: cleanSymbol,
            priceEUR: Number(priceEUR.toFixed(2)),
            originalPrice: rawPrice,
            currency: cur,
            changePct: Number(changePct.toFixed(2)),
          };
        }
      }
    } catch (e) {
      console.warn(`No se pudo obtener cotización para ${symbol}:`, e);
    }
    return null;
  },

  /**
   * Consulta en lote vía TradingView Global Scanner con mapeo inteligente de múltiples mercados
   */
  async fetchBatchTradingViewQuotes(positions: PositionItem[]): Promise<Record<string, { priceEUR: number; changePct: number }>> {
    const exchMap: Record<string, string> = {
      BMA: 'BME', BME: 'BME', MAD: 'BME', MCE: 'BME',
      XET: 'XETR', XETR: 'XETR', XETRA: 'XETR', TDG: 'XETR', FRA: 'XETR',
      AEX: 'EURONEXT', EAM: 'EURONEXT', EPA: 'EURONEXT', EURONEXT: 'EURONEXT', XAMS: 'EURONEXT', XPAR: 'EURONEXT',
      MIL: 'MIL', MILAN: 'MIL',
      NSY: 'NYSE', NYSE: 'NYSE', NDQ: 'NASDAQ', NASDAQ: 'NASDAQ',
      LSE: 'LSE', KRAKEN: 'KRAKEN', BINANCE: 'BINANCE',
    };

    const tvSymbols = new Set<string>();
    const posCandidateMap: Record<string, string[]> = {};

    for (const pos of positions) {
      if (pos.type === 'Fondos' || pos.broker === 'Urbanitae' || pos.ticker === 'PPI') continue;
      const baseTicker = pos.ticker.split(/[\s./|()]/)[0].trim().toUpperCase();
      const exchUpper = (pos.exchange || '').toUpperCase();
      const primaryExch = exchMap[exchUpper];

      const candidates: string[] = [];
      const isCryptoSpot = (pos.type === 'Cripto' || exchUpper === 'KRAKEN' || exchUpper === 'BINANCE') && !['2BTC', 'VBTC'].includes(baseTicker);

      if (isCryptoSpot) {
        candidates.push(`KRAKEN:${baseTicker}EUR`, `KRAKEN:${baseTicker}USD`, `BINANCE:${baseTicker}EUR`, `BINANCE:${baseTicker}USDT`);
      } else {
        if (primaryExch) candidates.push(`${primaryExch}:${baseTicker}`);
        // Fallbacks comunes en Europa y Wall Street
        ['XETR', 'EURONEXT', 'BME', 'MIL', 'LSE', 'NYSE', 'NASDAQ'].forEach(e => {
          candidates.push(`${e}:${baseTicker}`);
        });
        if (baseTicker === 'QQQ3') candidates.push('EURONEXT:QQQ3-ETFP');
      }

      posCandidateMap[pos.id] = candidates;
      candidates.forEach(c => tvSymbols.add(c));
    }

    if (tvSymbols.size === 0) return {};

    try {
      const res = await fetch('https://scanner.tradingview.com/global/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          symbols: { tickers: Array.from(tvSymbols) },
          columns: ['name', 'close', 'change', 'currency'],
        }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      const quoteMap: Record<string, { price: number; change: number; currency: string }> = {};

      for (const row of data?.data || []) {
        const tvKey = String(row.s || '');
        const d = row.d;
        if (!tvKey || !Array.isArray(d)) continue;
        const rawPrice = Number(d[1] || 0);
        const changePct = Number(d[2] || 0);
        const cur = String(d[3] || 'EUR');
        if (rawPrice > 0) {
          quoteMap[tvKey] = { price: rawPrice, change: changePct, currency: cur };
        }
      }

      const out: Record<string, { priceEUR: number; changePct: number }> = {};
      for (const pos of positions) {
        const candidates = posCandidateMap[pos.id] || [];
        let match: { price: number; change: number; currency: string } | null = null;
        for (const c of candidates) {
          if (quoteMap[c]) {
            match = quoteMap[c];
            break;
          }
        }
        if (match) {
          let priceEUR = match.price;
          if (match.currency === 'USD') priceEUR = priceEUR / this.eurUsdRate;
          else if (match.currency === 'GBP') priceEUR = priceEUR / this.eurGbpRate;
          else if (match.currency === 'GBX' || match.currency === 'GBp') priceEUR = (priceEUR / 100) / this.eurGbpRate;

          out[pos.id] = {
            priceEUR: Number(priceEUR.toFixed(3)),
            changePct: Number(match.change.toFixed(2)),
          };
        }
      }
      return out;
    } catch {
      return {};
    }
  },
  /**
   * Obtiene cotizaciones de criptoactivos desde CoinGecko en EUR
   */
  async fetchCryptoQuotes(): Promise<Record<string, { priceEUR: number; changePct: number }>> {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=eur&include_24hr_change=true');
      if (res.ok) {
        const data = await res.json();
        return {
          BTC: { priceEUR: data.bitcoin?.eur || 84250, changePct: data.bitcoin?.eur_24h_change || 0 },
          ETH: { priceEUR: data.ethereum?.eur || 3120, changePct: data.ethereum?.eur_24h_change || 0 },
          SOL: { priceEUR: data.solana?.eur || 182, changePct: data.solana?.eur_24h_change || 0 },
          // Estimación para ETPs de Bitcoin europeos
          '2BTC.F': { priceEUR: Number(((data.bitcoin?.eur || 84250) * 0.00022).toFixed(2)), changePct: data.bitcoin?.eur_24h_change || 0 },
          'VBTC.DE': { priceEUR: Number(((data.bitcoin?.eur || 84250) * 0.00035).toFixed(2)), changePct: data.bitcoin?.eur_24h_change || 0 },
        };
      }
    } catch (e) {
      console.warn('Fallo al consultar CoinGecko:', e);
    }
    return {};
  },

  /**
   * Actualiza en lote todas las posiciones de la cartera con precios reales de mercado.
   */
  async updateAllPositionsWithLiveMarketData(positions: PositionItem[]): Promise<{
    updatedPositions: PositionItem[];
    successCount: number;
    timestamp: string;
  }> {
    await this.getLiveEurUsdRate();
    const [cryptoData, tvBatchQuotes] = await Promise.all([
      this.fetchCryptoQuotes(),
      this.fetchBatchTradingViewQuotes(positions),
    ]);

    let successCount = 0;
    const updatedPositions: PositionItem[] = [];

    for (const pos of positions) {
      // Fondos de inversión y proyectos Urbanitae mantienen su valor liquidativo/inversión sin sobrescribir
      if (pos.type === 'Fondos' || pos.broker === 'Urbanitae') {
        updatedPositions.push(pos);
        continue;
      }

      let livePrice = pos.currentPrice;
      let liveChangePct = pos.dailyChangePct;

      const tickerUpper = pos.ticker.toUpperCase();
      const isCrypto = pos.type === 'Cripto' || tickerUpper.includes('BTC') || tickerUpper.includes('ETH');

      if (tvBatchQuotes[pos.id]) {
        livePrice = tvBatchQuotes[pos.id].priceEUR;
        liveChangePct = tvBatchQuotes[pos.id].changePct;
        successCount++;
      } else if (isCrypto && (cryptoData[tickerUpper] || cryptoData['BTC'])) {
        const c = cryptoData[tickerUpper] || cryptoData['2BTC.F'] || cryptoData['BTC'];
        livePrice = c.priceEUR;
        liveChangePct = c.changePct;
        successCount++;
      } else {
        // Respaldo Yahoo Finance
        const stockQuote = await this.fetchStockQuote(pos.ticker);
        if (stockQuote && stockQuote.priceEUR > 0) {
          livePrice = stockQuote.priceEUR;
          liveChangePct = stockQuote.changePct;
          successCount++;
        }
      }

      const totalValue = Number((pos.shares * livePrice).toFixed(2));
      const totalCost = Number((pos.shares * pos.avgPrice).toFixed(2));
      const unrealizedGainLoss = Number((totalValue - totalCost).toFixed(2));
      const unrealizedGainLossPct = totalCost > 0 ? Number(((unrealizedGainLoss / totalCost) * 100).toFixed(2)) : 0;
      const dailyChangeValue = Number(((totalValue * liveChangePct) / 100).toFixed(2));

      updatedPositions.push({
        ...pos,
        currentPrice: livePrice,
        dailyChangePct: liveChangePct,
        dailyChangeValue,
        totalValue,
        unrealizedGainLoss,
        unrealizedGainLossPct,
        sparkline: generateSampleSparkline(liveChangePct),
      });
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return {
      updatedPositions,
      successCount,
      timestamp,
    };
  },

  /**
   * Busca activos globales en tiempo real (acciones, ETFs, fondos de todas las bolsas del mundo: BME, MIL, XETR, EURONEXT, LSE, NYSE, NASDAQ)
   * Usa TradingView Global Scanner (CORS nativo, 0€ gratis, sin bloqueos) + precio en vivo incluido.
   */
  async searchGlobalMarketAssets(query: string): Promise<Array<{
    symbol: string;
    yahooSymbol: string;
    name: string;
    exchange: string;
    quoteType: string;
    countryFlag: string;
    assetType: 'Acciones' | 'ETFs' | 'Fondos' | 'Cripto';
    priceEUR: number;
    changePct: number;
  }>> {
    const clean = query.trim();
    if (clean.length < 2) return [];

    const runTvScan = async (field: 'name' | 'description') => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch('https://scanner.tradingview.com/global/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            filter: [{ left: field, operation: 'match', right: clean }],
            columns: ['name', 'description', 'exchange', 'close', 'change', 'currency', 'type'],
            range: [0, 20],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json?.data) ? json.data : [];
      } catch {
        clearTimeout(timer);
        return [];
      }
    };

    const [byName, byDesc] = await Promise.all([runTvScan('name'), runTvScan('description')]);
    const combined = [...byName, ...byDesc];
    const seen = new Set<string>();
    const results: Array<{
      symbol: string;
      yahooSymbol: string;
      name: string;
      exchange: string;
      quoteType: string;
      countryFlag: string;
      assetType: 'Acciones' | 'ETFs' | 'Fondos' | 'Cripto';
      priceEUR: number;
      changePct: number;
    }> = [];

    for (const item of combined) {
      const s = String(item?.s || '');
      const d = item?.d;
      if (!s || !Array.isArray(d) || seen.has(s)) continue;
      seen.add(s);

      const ticker = String(d[0] || '').toUpperCase();
      const desc = String(d[1] || ticker);
      const exch = String(d[2] || '').toUpperCase();
      const rawClose = Number(d[3] || 0);
      const rawChange = Number(d[4] || 0);
      const currency = String(d[5] || 'EUR');
      const tvType = String(d[6] || 'stock').toLowerCase();

      // Determinar bandera y sufijo Yahoo según bolsa
      let countryFlag = '🌐';
      let yahooSuffix = '';
      if (exch === 'BME' || exch === 'MADRID') {
        countryFlag = '🇪🇸';
        yahooSuffix = '.MC';
      } else if (exch === 'MIL' || exch === 'MILAN' || exch === 'EUROTLX') {
        countryFlag = '🇮🇹';
        yahooSuffix = '.MI';
      } else if (exch === 'XETR' || exch === 'FWB' || exch === 'GETTEX' || exch === 'TRADEGATE') {
        countryFlag = '🇩🇪';
        yahooSuffix = '.DE';
      } else if (exch === 'EURONEXT' || exch === 'EPA') {
        countryFlag = '🇪🇺';
        yahooSuffix = '.AS';
      } else if (exch === 'LSE' || exch === 'LSIN') {
        countryFlag = '🇬🇧';
        yahooSuffix = '.L';
      } else if (exch === 'SIX') {
        countryFlag = '🇨🇭';
        yahooSuffix = '.SW';
      } else if (exch === 'NYSE' || exch === 'NASDAQ' || exch === 'AMEX' || exch === 'ARCA') {
        countryFlag = '🇺🇸';
        yahooSuffix = '';
      }

      const yahooSymbol = ticker.includes('.') || ticker.includes('-') ? ticker : `${ticker}${yahooSuffix}`;

      // Convertir precio a EUR
      let priceEUR = rawClose;
      if (currency === 'USD') {
        priceEUR = rawClose / this.eurUsdRate;
      } else if (currency === 'GBX' || currency === 'GBp') {
        priceEUR = (rawClose / 100) / this.eurGbpRate;
      } else if (currency === 'GBP') {
        priceEUR = rawClose / this.eurGbpRate;
      }

      let assetType: 'Acciones' | 'ETFs' | 'Fondos' | 'Cripto' = 'Acciones';
      if (tvType === 'fund' || desc.toUpperCase().includes('ETF') || desc.toUpperCase().includes('UCITS') || desc.toUpperCase().includes('LEVERAGED')) {
        assetType = 'ETFs';
      } else if (tvType === 'crypto') {
        assetType = 'Cripto';
      }

      results.push({
        symbol: `${ticker}${yahooSuffix}`,
        yahooSymbol,
        name: desc,
        exchange: exch || 'Global',
        quoteType: tvType.toUpperCase(),
        countryFlag,
        assetType,
        priceEUR: Number(priceEUR.toFixed(2)),
        changePct: Number(rawChange.toFixed(2)),
      });
    }

    return results;
  },
};
