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
   * Obtiene la tasa de cambio EUR/USD en tiempo real
   */
  async getLiveEurUsdRate(): Promise<number> {
    try {
      const url = '/api/finance/v8/finance/chart/EURUSD=X?interval=1d&range=1d';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (rate && rate > 0) {
          this.eurUsdRate = rate;
          return rate;
        }
      }
    } catch (e) {
      console.warn('Usando tasa EUR/USD de referencia:', this.eurUsdRate);
    }
    return this.eurUsdRate;
  },

  /**
   * Consulta una cotización individual de Yahoo Finance (en servidor local o con proxy de respaldo)
   */
  async fetchStockQuote(symbol: string): Promise<LiveMarketQuote | null> {
    try {
      // Limpiar ticker (ej: "NVDA / US67066G1040" -> "NVDA")
      let cleanSymbol = symbol.split(/[\s/|]/)[0].trim().toUpperCase();

      // Buscar si el activo tiene símbolo específico de Yahoo en nuestro catálogo completo
      const catalogMatch = COMPREHENSIVE_CATALOG.find(
        c => c.ticker.toUpperCase() === cleanSymbol || (c.yahooSymbol && c.yahooSymbol.toUpperCase() === cleanSymbol)
      );
      if (catalogMatch?.yahooSymbol) {
        cleanSymbol = catalogMatch.yahooSymbol;
      } else {
        // Mapeos comunes de respaldo
        if (cleanSymbol === 'ENG') cleanSymbol = 'ENG.MC';
        if (cleanSymbol === 'SAN') cleanSymbol = 'SAN.MC';
        if (cleanSymbol === 'ITX') cleanSymbol = 'ITX.MC';
        if (cleanSymbol === 'LOG') cleanSymbol = 'LOG.MC';
        if (cleanSymbol === 'VUSA') cleanSymbol = 'VUSA.AS';
      }

      // 1. Intentar a través del proxy local de Vite
      let res = await fetch(`/api/finance/v8/finance/chart/${cleanSymbol}?interval=1d&range=1d`).catch(() => null);
      
      // 2. Si no responde por estar fuera de Vite (GitHub Pages), usar proxies CORS gratuitos
      if (!res || !res.ok) {
        const yahooChartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=1d`;
        res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(yahooChartUrl)}`).catch(() => null);
      }
      if (!res || !res.ok) {
        const yahooChartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${cleanSymbol}?interval=1d&range=1d`;
        res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(yahooChartUrl)}`).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const rawPrice = meta.regularMarketPrice;
          const rawCurrency = meta.currency || 'USD';
          const currency = rawCurrency.toUpperCase();
          const prevClose = meta.chartPreviousClose || rawPrice;
          const changePct = prevClose > 0 ? ((rawPrice - prevClose) / prevClose) * 100 : 0;

          // Convertir a EUR según divisa (USD, GBP o peniques GBp)
          let priceEUR = rawPrice;
          if (currency === 'USD') {
            priceEUR = rawPrice / this.eurUsdRate;
          } else if (rawCurrency === 'GBp' || rawCurrency === 'GBX') {
            // Londres cotiza muchas acciones en peniques (GBp = 0.01 GBP)
            priceEUR = (rawPrice / 100) / this.eurGbpRate;
          } else if (currency === 'GBP') {
            priceEUR = rawPrice / this.eurGbpRate;
          }

          return {
            ticker: cleanSymbol,
            priceEUR: Number(priceEUR.toFixed(2)),
            originalPrice: rawPrice,
            currency,
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
    const cryptoData = await this.fetchCryptoQuotes();

    let successCount = 0;
    const updatedPositions: PositionItem[] = [];

    for (const pos of positions) {
      let livePrice = pos.currentPrice;
      let liveChangePct = pos.dailyChangePct;

      const tickerUpper = pos.ticker.toUpperCase();
      const isCrypto = pos.type === 'Cripto' || tickerUpper.includes('BTC') || tickerUpper.includes('ETH');

      if (isCrypto && (cryptoData[tickerUpper] || cryptoData['BTC'])) {
        const c = cryptoData[tickerUpper] || cryptoData['2BTC.F'] || cryptoData['BTC'];
        livePrice = c.priceEUR;
        liveChangePct = c.changePct;
        successCount++;
      } else {
        // Intentar consultar Yahoo Finance
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
