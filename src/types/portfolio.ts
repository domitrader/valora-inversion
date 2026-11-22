export type MainTab = 'inicio' | 'eventos' | 'explorar' | 'seguimiento' | 'perfil';

export type InicioSubTab = 'portafolio' | 'dividendos';

export type AssetType = 'Acciones' | 'ETFs' | 'Fondos' | 'Cripto';

export type TimeRange = '1D' | '1S' | '1M' | '3M' | 'YTD' | '1A' | '5A';

export type SortOption = 'name-asc' | 'name-desc' | 'change-asc' | 'change-desc' | 'custom';

export interface ChartDataPoint {
  date: string;
  label: string;
  value: number;
  change?: number;
  changePct?: number;
}

export type PositionViewFilter = 'abiertas' | 'cerradas' | 'todas';

export interface ClosedPositionItem {
  id: string;
  name: string;
  isin: string;
  exchange: string;
  exchangeName: string;
  flag: string;
  type: AssetType;
  realized_pnl: number;
  total_fees: number;
  trades_count: number;
  total_bought_val: number;
  total_sold_val: number;
  first_trade: string;
  last_trade: string;
  status: 'Cerrada';
}

export interface PositionItem {
  id: string;
  name: string;
  ticker: string;
  isin?: string;
  type: AssetType;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currency: string;
  purchaseDate?: string;
  market?: string;
  exchange?: string;
  exchangeName?: string;
  countryFlag?: string;
  logoBg?: string;
  logoText?: string;
  dailyChangePct: number;
  dailyChangeValue: number;
  totalValue: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPct: number;
  sparkline: number[];
  dividendYield?: number;
  annualDividendPerShare?: number;
  nextDividendDate?: string;
  nextEarningsDate?: string;
  status?: 'Abierta' | 'Cerrada';
  broker?: string;
}

export interface WatchlistItem {
  id: string;
  name: string;
  ticker: string;
  isin?: string;
  type: AssetType;
  price: number;
  currency: string;
  dailyChangePct: number;
  dailyChangeValue: number;
  countryFlag?: string;
  market?: string;
  logoBg?: string;
  logoText?: string;
  sparkline: number[];
  hasEarningsSoon?: boolean;
  hasDividendSoon?: boolean;
  customOrder?: number;
}

export interface FinancialEvent {
  id: string;
  type: 'ex-dividend' | 'pago-dividendo' | 'resultados' | 'split';
  ticker: string;
  assetName: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "BMO" | "AMC" | "09:00 CET"
  estimatedAmount?: number;
  dividendPerShare?: number;
  confirmed: boolean;
  sharesOwned?: number;
  estimatedEarningsPerShare?: number;
  revenueEstimate?: string;
  description: string;
  logoBg?: string;
  logoText?: string;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  dailyChangeValue: number;
  dailyChangePct: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPct: number;
  annualProjectedDividends: number;
  monthlyAverageDividends: number;
  dividendYieldPct: number;
}

export interface PortfolioMeta {
  id: string;
  name: string;
  currency: 'EUR' | 'USD' | 'GBP';
  createdAt: string;
  isDefault?: boolean;
}

export interface TradingAnalytics {
  totalTrades: number;
  totalFeesPaid: number;
  totalRealizedPnl: number;
  startDate: string;
  endDate: string;
  tradedProductsCount: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
  netCashFlow?: number;
  totalDividendsReceived?: number;
  currentCashBalance?: number;
}

export interface HistoricalAssetStat {
  isin: string;
  name: string;
  type: AssetType;
  shares: number;
  cost_basis: number;
  total_bought_qty: number;
  total_sold_qty: number;
  total_bought_val: number;
  total_sold_val: number;
  realized_pnl: number;
  total_fees: number;
  trades_count: number;
  first_trade: string;
  last_trade: string;
  status: 'Abierta' | 'Cerrada';
}

export interface PortfolioState {
  cash: number;
  goalAmount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  hideFigures: boolean;
  selectedTimeRange: TimeRange;
  theme?: 'light' | 'dark' | 'system';
  activePortfolioId: string;
  portfolios: PortfolioMeta[];
  positions: PositionItem[];
  watchlist: WatchlistItem[];
  events: FinancialEvent[];
  tradingAnalytics?: TradingAnalytics;
  historicalAssetStats?: HistoricalAssetStat[];
}

export interface DividendPaymentItem {
  date: string;
  year: string;
  month: string;
  product: string;
  isin: string;
  gross: number;
  tax: number;
  net: number;
  currency: string;
  broker: string;
  flag: string;
  descriptions?: string[];
}

export interface AnnualDividendSummary {
  year: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
}

export interface ProductDividendSummary {
  product: string;
  isin: string;
  flag: string;
  gross: number;
  tax: number;
  net: number;
  count: number;
}

export interface FutureDividendProjection {
  id: string;
  product: string;
  ticker: string;
  isin: string;
  shares: number;
  broker: string;
  flag: string;
  month: string;
  quarter: string;
  estimatedDate: string;
  dividendPerShare: number;
  currency: string;
  estimatedGrossEUR: number;
  estimatedTaxEUR: number;
  estimatedNetEUR: number;
  frequency: string;
  status: string;
}


export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timeAgo: string;
  url: string;
  relatedTickers: string[];
  sentiment?: 'positivo' | 'neutro' | 'alerta';
  summary?: string;
}

export interface ParsedPositionRow {
  name: string;
  ticker: string;
  isin?: string;
  type: AssetType;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  isValid: boolean;
  errorMessage?: string;
}
