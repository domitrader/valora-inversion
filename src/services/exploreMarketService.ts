/**
 * Servicio 100% en tiempo real para la sección Explorar:
 * - Mercados Globales en Vivo (TradingView Global Scanner)
 * - Tendencias del Día (Top Gainers & Top Losers reales)
 * - Calendario Semanal de Resultados / Earnings (Lunes a Viernes, BMO / AMC)
 * - Calendario Global de Dividendos (España, EE.UU., Reino Unido, Francia, Alemania, Italia, Países Bajos, Suiza)
 * - Noticias Financieras Reales (Google News RSS via rss2json / allorigins)
 */

export interface LiveMarketIndex {
  symbol: string;
  label: string;
  flag: string;
  category: 'Índices' | 'Materias / Cripto' | 'Divisas';
  price: number;
  changePct: number;
  currency: string;
}

export interface LiveMoverItem {
  ticker: string;
  fullSymbol: string;
  name: string;
  price: number;
  changePct: number;
  currency: string;
  marketCapB: number;
}

export interface LiveEarningsItem {
  ticker: string;
  fullSymbol: string;
  name: string;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number; // 1=Mon .. 5=Fri
  session: 'BMO' | 'AMC'; // Antes de Apertura / Tras el Cierre
  marketCapB: number;
  price: number;
  changePct: number;
  currency: string;
  sector?: string;
}

export interface WeeklyEarningsDay {
  dayIndex: number; // 1..5
  dayName: string; // Lunes..Viernes
  dateStr: string; // YYYY-MM-DD
  dateLabel: string; // "23 nov"
  bmo: LiveEarningsItem[];
  amc: LiveEarningsItem[];
}

export interface GlobalDividendItem {
  ticker: string;
  fullSymbol: string;
  name: string;
  country: DividendMarketKey;
  exchange: string;
  yieldPct: number;
  exDateStr: string | null; // YYYY-MM-DD
  exDateTs: number | null;
  dividendAmount: number | null;
  price: number;
  changePct: number;
  currency: string;
  marketCapB: number;
}

export type DividendMarketKey =
  | 'spain'
  | 'america'
  | 'uk'
  | 'france'
  | 'germany'
  | 'italy'
  | 'netherlands'
  | 'switzerland';

export interface RealNewsArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
  topic: string;
}

export const DIVIDEND_MARKETS: {
  key: DividendMarketKey;
  label: string;
  flag: string;
  scanner: string;
  exchanges: string[];
  currencyFallback: string;
}[] = [
  { key: 'spain', label: 'España', flag: '🇪🇸', scanner: 'spain', exchanges: ['BME'], currencyFallback: 'EUR' },
  { key: 'america', label: 'EE.UU.', flag: '🇺🇸', scanner: 'america', exchanges: ['NYSE', 'NASDAQ'], currencyFallback: 'USD' },
  { key: 'uk', label: 'Reino Unido', flag: '🇬🇧', scanner: 'uk', exchanges: ['LSE'], currencyFallback: 'GBP' },
  { key: 'france', label: 'Francia', flag: '🇫🇷', scanner: 'france', exchanges: ['EURONEXT'], currencyFallback: 'EUR' },
  { key: 'germany', label: 'Alemania', flag: '🇩🇪', scanner: 'germany', exchanges: ['XETR'], currencyFallback: 'EUR' },
  { key: 'italy', label: 'Italia', flag: '🇮🇹', scanner: 'italy', exchanges: ['MIL'], currencyFallback: 'EUR' },
  { key: 'netherlands', label: 'Países Bajos', flag: '🇳🇱', scanner: 'netherlands', exchanges: ['EURONEXT'], currencyFallback: 'EUR' },
  { key: 'switzerland', label: 'Suiza', flag: '🇨🇭', scanner: 'switzerland', exchanges: ['SIX'], currencyFallback: 'CHF' },
];

async function tvScan(market: string, payload: Record<string, any>): Promise<any[]> {
  const res = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`TradingView HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

/**
 * 1. Mercados Globales en Vivo
 */
export async function fetchLiveMarketsSummary(): Promise<LiveMarketIndex[]> {
  const specs: Array<{ symbol: string; label: string; flag: string; category: LiveMarketIndex['category']; currency: string }> = [
    { symbol: 'NASDAQ:NDX', label: 'Nasdaq 100', flag: '🇺🇸', category: 'Índices', currency: 'pts' },
    { symbol: 'SP:SPX', label: 'S&P 500', flag: '🇺🇸', category: 'Índices', currency: 'pts' },
    { symbol: 'BME:IBC', label: 'IBEX 35', flag: '🇪🇸', category: 'Índices', currency: 'pts' },
    { symbol: 'XETR:DAX', label: 'DAX 40', flag: '🇩🇪', category: 'Índices', currency: 'pts' },
    { symbol: 'TVC:GOLD', label: 'Oro Spot', flag: '🥇', category: 'Materias / Cripto', currency: 'USD' },
    { symbol: 'BITSTAMP:BTCEUR', label: 'Bitcoin (EUR)', flag: '₿', category: 'Materias / Cripto', currency: 'EUR' },
    { symbol: 'BITSTAMP:ETHEUR', label: 'Ethereum (EUR)', flag: 'Ξ', category: 'Materias / Cripto', currency: 'EUR' },
    { symbol: 'FX_IDC:EURUSD', label: 'EUR / USD', flag: '💱', category: 'Divisas', currency: 'USD' },
  ];

  const rows = await tvScan('global', {
    symbols: { tickers: specs.map(s => s.symbol), query: { types: [] } },
    columns: ['close', 'change', 'currency'],
  });

  const bySymbol = new Map<string, { close: number; change: number; currency: string }>();
  for (const r of rows) {
    if (r?.s && Array.isArray(r.d)) {
      bySymbol.set(r.s, {
        close: Number(r.d[0] || 0),
        change: Number(r.d[1] || 0),
        currency: r.d[2] || '',
      });
    }
  }

  return specs
    .map(spec => {
      const hit = bySymbol.get(spec.symbol);
      if (!hit || hit.close <= 0) return null;
      return {
        symbol: spec.symbol,
        label: spec.label,
        flag: spec.flag,
        category: spec.category,
        price: Number(hit.close.toFixed(spec.category === 'Divisas' ? 4 : 2)),
        changePct: Number(hit.change.toFixed(2)),
        currency: spec.currency,
      };
    })
    .filter((x): x is LiveMarketIndex => x !== null);
}

/**
 * 2. Tendencias del Día (Top Gainers & Top Losers reales)
 */
export async function fetchTopMovers(
  region: 'america' | 'spain' | 'europe' | 'crypto'
): Promise<{ gainers: LiveMoverItem[]; losers: LiveMoverItem[] }> {
  const scanner = region === 'europe' ? 'germany' : region === 'crypto' ? 'crypto' : region;
  const baseFilter: any[] =
    region === 'crypto'
      ? [
          { left: 'exchange', operation: 'equal', right: 'BINANCE' },
          { left: 'name', operation: 'match', right: 'EUR$' },
        ]
      : region === 'spain'
        ? [
            { left: 'exchange', operation: 'equal', right: 'BME' },
            { left: 'market_cap_basic', operation: 'greater', right: 300_000_000 },
          ]
        : region === 'europe'
          ? [
              { left: 'exchange', operation: 'equal', right: 'XETR' },
              { left: 'market_cap_basic', operation: 'greater', right: 5_000_000_000 },
            ]
          : [
              { left: 'exchange', operation: 'in_range', right: ['NYSE', 'NASDAQ'] },
              { left: 'market_cap_basic', operation: 'greater', right: 15_000_000_000 },
            ];

  const cols =
    region === 'crypto'
      ? ['name', 'description', 'close', 'change', 'currency']
      : ['name', 'description', 'close', 'change', 'currency', 'market_cap_basic'];

  const [gainerRows, loserRows] = await Promise.all([
    tvScan(scanner, {
      filter: [...baseFilter, { left: 'change', operation: 'greater', right: 0 }],
      options: { lang: 'es' },
      symbols: { query: { types: region === 'crypto' ? [] : ['stock'] } },
      columns: cols,
      sort: { sortBy: 'change', sortOrder: 'desc' },
      range: [0, 8],
    }),
    tvScan(scanner, {
      filter: [...baseFilter, { left: 'change', operation: 'less', right: 0 }],
      options: { lang: 'es' },
      symbols: { query: { types: region === 'crypto' ? [] : ['stock'] } },
      columns: cols,
      sort: { sortBy: 'change', sortOrder: 'asc' },
      range: [0, 8],
    }),
  ]);

  const mapRow = (r: any): LiveMoverItem => ({
    ticker: String(r.d[0] || '').replace(/EUR$/, ''),
    fullSymbol: r.s || '',
    name: String(r.d[1] || r.d[0] || ''),
    price: Number(Number(r.d[2] || 0).toFixed(2)),
    changePct: Number(Number(r.d[3] || 0).toFixed(2)),
    currency: String(r.d[4] || (region === 'america' ? 'USD' : 'EUR')),
    marketCapB: r.d[5] ? Number((Number(r.d[5]) / 1e9).toFixed(1)) : 0,
  });

  return {
    gainers: gainerRows.map(mapRow),
    losers: loserRows.map(mapRow),
  };
}

/**
 * Calcula Lunes..Viernes para un weekOffset (0 = esta semana, +1 = semana siguiente, -1 = anterior)
 */
export function getWeekDateBounds(weekOffset: number): {
  monday: Date;
  friday: Date;
  label: string;
  days: { dayIndex: number; dayName: string; dateStr: string; dateLabel: string }[];
} {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon + weekOffset * 7, 0, 0, 0));
  const friday = new Date(monday.getTime() + 4 * 86400 * 1000 + 86399 * 1000);

  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const days = dayNames.map((name, idx) => {
    const d = new Date(monday.getTime() + idx * 86400 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return {
      dayIndex: idx + 1,
      dayName: name,
      dateStr: `${yyyy}-${mm}-${dd}`,
      dateLabel: `${d.getUTCDate()} ${monthsShort[d.getUTCMonth()]}`,
    };
  });

  const label = `${days[0].dateLabel} – ${days[4].dateLabel} ${monday.getUTCFullYear()}`;
  return { monday, friday, label, days };
}

/**
 * 3. Calendario Semanal de Resultados (Earnings) — 100% Real en Vivo (estilo Stock Analysis)
 */
export async function fetchWeeklyEarnings(
  weekOffset: number,
  region: 'america' | 'europe' | 'spain'
): Promise<{ weekLabel: string; days: WeeklyEarningsDay[]; totalCount: number }> {
  const { monday, friday, label, days } = getWeekDateBounds(weekOffset);
  const startTs = Math.floor(monday.getTime() / 1000);
  const endTs = Math.floor(friday.getTime() / 1000);

  const scanner = region === 'europe' ? 'global' : region;
  const filter: any[] = [
    { left: 'earnings_release_next_date', operation: 'in_range', right: [startTs, endTs] },
  ];

  if (region === 'america') {
    filter.push({ left: 'exchange', operation: 'in_range', right: ['NYSE', 'NASDAQ'] });
    filter.push({ left: 'market_cap_basic', operation: 'greater', right: 300_000_000 });
  } else if (region === 'spain') {
    filter.push({ left: 'exchange', operation: 'equal', right: 'BME' });
  } else {
    filter.push({ left: 'exchange', operation: 'in_range', right: ['BME', 'EURONEXT', 'XETR', 'LSE', 'MIL', 'SIX'] });
    filter.push({ left: 'market_cap_basic', operation: 'greater', right: 1_000_000_000 });
  }

  const rows = await tvScan(scanner, {
    filter,
    options: { lang: 'es' },
    symbols: { query: { types: ['stock', 'dr'] } },
    columns: [
      'name',
      'description',
      'earnings_release_next_date',
      'market_cap_basic',
      'close',
      'change',
      'currency',
      'sector',
    ],
    sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
    range: [0, 80],
  });

  const dayMap = new Map<string, WeeklyEarningsDay>();
  for (const d of days) {
    dayMap.set(d.dateStr, {
      ...d,
      bmo: [],
      amc: [],
    });
  }

  const seenTickers = new Set<string>();
  let totalCount = 0;

  for (const r of rows) {
    const ticker = String(r.d[0] || '');
    const ts = Number(r.d[2] || 0);
    if (!ticker || !ts || seenTickers.has(ticker)) continue;
    seenTickers.add(ticker);

    const dt = new Date(ts * 1000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const bucket = dayMap.get(dateStr);
    if (!bucket) continue;

    // En EE.UU. mercado abre 14:30 UTC y cierra 21:00 UTC -> >= 17:00 UTC = Tras el cierre (AMC)
    const utcHour = dt.getUTCHours();
    const session: 'BMO' | 'AMC' = utcHour >= 17 ? 'AMC' : 'BMO';

    const item: LiveEarningsItem = {
      ticker,
      fullSymbol: r.s || ticker,
      name: String(r.d[1] || ticker),
      dateStr,
      dayOfWeek: bucket.dayIndex,
      session,
      marketCapB: r.d[3] ? Number((Number(r.d[3]) / 1e9).toFixed(1)) : 0,
      price: Number(Number(r.d[4] || 0).toFixed(2)),
      changePct: Number(Number(r.d[5] || 0).toFixed(2)),
      currency: String(r.d[6] || (region === 'america' ? 'USD' : 'EUR')),
      sector: r.d[7] ? String(r.d[7]) : undefined,
    };

    if (session === 'BMO') bucket.bmo.push(item);
    else bucket.amc.push(item);
    totalCount++;
  }

  return {
    weekLabel: label,
    days: Array.from(dayMap.values()),
    totalCount,
  };
}

/**
 * 4. Calendario Global de Dividendos (España, EE.UU., Reino Unido, Francia, Alemania, Italia, Países Bajos, Suiza)
 */
export async function fetchGlobalDividends(
  country: DividendMarketKey,
  mode: 'upcoming' | 'high_yield',
  searchQuery = ''
): Promise<GlobalDividendItem[]> {
  const cfg = DIVIDEND_MARKETS.find(m => m.key === country) || DIVIDEND_MARKETS[0];
  const nowTs = Math.floor(Date.now() / 1000);
  const horizonTs = nowTs + 90 * 86400; // próximos 90 días

  const filter: any[] = [
    { left: 'exchange', operation: 'in_range', right: cfg.exchanges },
    { left: 'dividends_yield_current', operation: 'greater', right: 0.5 },
  ];

  if (mode === 'upcoming') {
    filter.push({
      left: 'dividend_ex_date_upcoming',
      operation: 'in_range',
      right: [nowTs - 86400, horizonTs],
    });
  } else {
    filter.push({
      left: 'market_cap_basic',
      operation: 'greater',
      right: country === 'spain' ? 200_000_000 : 1_500_000_000,
    });
  }

  if (searchQuery.trim()) {
    filter.push({
      left: 'description',
      operation: 'match',
      right: searchQuery.trim(),
    });
  }

  const rows = await tvScan(cfg.scanner, {
    filter,
    options: { lang: 'es' },
    symbols: { query: { types: ['stock'] } },
    columns: [
      'name',
      'description',
      'dividends_yield_current',
      'dividend_ex_date_upcoming',
      'dividend_amount_upcoming',
      'close',
      'change',
      'currency',
      'market_cap_basic',
      'exchange',
    ],
    sort:
      mode === 'upcoming'
        ? { sortBy: 'dividend_ex_date_upcoming', sortOrder: 'asc' }
        : { sortBy: 'dividends_yield_current', sortOrder: 'desc' },
    range: [0, 40],
  });

  return rows.map(r => {
    const exTs = r.d[3] ? Number(r.d[3]) : null;
    let exDateStr: string | null = null;
    if (exTs && exTs > 0) {
      const dt = new Date(exTs * 1000);
      exDateStr = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
    return {
      ticker: String(r.d[0] || ''),
      fullSymbol: r.s || '',
      name: String(r.d[1] || r.d[0] || ''),
      country,
      exchange: String(r.d[9] || cfg.exchanges[0]),
      yieldPct: Number(Number(r.d[2] || 0).toFixed(2)),
      exDateStr,
      exDateTs: exTs,
      dividendAmount: r.d[4] != null ? Number(Number(r.d[4]).toFixed(4)) : null,
      price: Number(Number(r.d[5] || 0).toFixed(2)),
      changePct: Number(Number(r.d[6] || 0).toFixed(2)),
      currency: String(r.d[7] || cfg.currencyFallback),
      marketCapB: r.d[8] ? Number((Number(r.d[8]) / 1e9).toFixed(1)) : 0,
    };
  });
}

/**
 * 5. Noticias Financieras Reales del día (Google News RSS -> rss2json)
 */
export async function fetchRealFinancialNews(
  topic: 'all' | 'NVDA' | 'Oro' | 'Nasdaq' | 'Bitcoin' | 'IBEX'
): Promise<RealNewsArticle[]> {
  const queryMap: Record<typeof topic, string> = {
    all: 'bolsa mercados acciones Nasdaq IBEX',
    NVDA: 'NVIDIA acciones bolsa',
    Oro: 'precio oro cotizacion mercado',
    Nasdaq: 'Nasdaq 100 Wall Street bolsa',
    Bitcoin: 'Bitcoin precio mercado ETF',
    IBEX: 'IBEX 35 bolsa Madrid dividendos',
  };

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(queryMap[topic])}&hl=es&gl=ES&ceid=ES:es`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items.slice(0, 15).map((it: any, idx: number) => {
    const rawTitle = String(it.title || '');
    const parts = rawTitle.split(' - ');
    const source = parts.length > 1 ? parts.pop()!.trim() : 'Google Finanzas';
    const cleanTitle = parts.join(' - ').trim() || rawTitle;

    return {
      id: `news-${topic}-${idx}`,
      title: cleanTitle,
      source,
      publishedAt: it.pubDate || '',
      link: it.link || '#',
      topic,
    };
  });
}
