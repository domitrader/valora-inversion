import { PortfolioState } from '../types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from '../data/mockPortfolio';

const LOCAL_STORAGE_KEY = 'valora_portfolio_state_v6';
const SUPABASE_CONFIG_KEY = 'valora_supabase_config_v1';
const CLOUD_ROW_ID = 'domingo_portfolio';

const DEFAULT_SUPABASE_URL = 'https://hveszaejunbguilywipu.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_V0QP2u2j3Ds_-cPTItsgBw_1RGlkerw';

// Legacy keys to clean up
const LEGACY_STORAGE_KEYS = [
  'valora_portfolio_state_v1',
  'valora_portfolio_state_v2',
  'valora_portfolio_state_v3',
  'valora_portfolio_state_v4',
  'valora_portfolio_state_v5'
];

export interface SupabaseCloudConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
  lastSyncedAt?: string;
}

function buildHeaders(key: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    ...(extra || {}),
  };
  // Solo enviar Authorization Bearer si es un JWT clásico (eyJ...), las nuevas sb_publishable_ usan solo apikey
  if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

/**
 * Service layer for Supabase connection (PostgreSQL REST API) + LocalStorage fallback.
 * Preconfigurado con el proyecto gratuito en la nube del usuario.
 */
export class SupabaseService {
  private static config: SupabaseCloudConfig | null = null;

  public static getSavedConfig(): SupabaseCloudConfig | null {
    if (this.config) return this.config;
    try {
      const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (raw) {
        this.config = JSON.parse(raw);
        return this.config;
      }
    } catch {}
    // Preconfiguración por defecto lista para usar
    this.config = {
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_KEY,
      enabled: true,
    };
    return this.config;
  }

  public static saveConfig(cfg: SupabaseCloudConfig | null): void {
    this.config = cfg;
    try {
      if (cfg) {
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cfg));
      } else {
        localStorage.removeItem(SUPABASE_CONFIG_KEY);
      }
    } catch {}
  }

  /**
   * Initializes or checks connection to Supabase
   */
  public static async init(supabaseUrl?: string, supabaseAnonKey?: string): Promise<boolean> {
    if (supabaseUrl && supabaseAnonKey) {
      const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
      const cleanKey = supabaseAnonKey.trim();
      const cfg: SupabaseCloudConfig = { url: cleanUrl, anonKey: cleanKey, enabled: true };
      this.saveConfig(cfg);
      return await this.testConnection(cleanUrl, cleanKey);
    }
    const existing = this.getSavedConfig();
    return Boolean(existing?.enabled && existing.url && existing.anonKey);
  }

  public static async testConnection(url: string, anonKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/rest/v1/portfolio_states?id=eq.${CLOUD_ROW_ID}&select=id`, {
        method: 'GET',
        headers: buildHeaders(anonKey),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Garantiza que las posiciones auditadas de DEGIRO conserven siempre su historicalNetCashFlow y avgPrice reales,
   * protegiendo contra pestañas antiguas abiertas que hayan sobrescrito Supabase con datos sin auditar.
   */
  private static enforceAuditedDegiroData(state: PortfolioState): PortfolioState {
    if (!state?.positions || !Array.isArray(state.positions)) return state;
    const auditedById = new Map(INITIAL_PORTFOLIO_STATE.positions.map(p => [p.id, p]));
    let patched = false;

    const fixedPositions = state.positions.map(pos => {
      const audited = auditedById.get(pos.id);
      if (audited && typeof audited.historicalNetCashFlow === 'number') {
        const missingFlow = typeof pos.historicalNetCashFlow !== 'number';
        const missingPeak = typeof audited.historicalPeakCapital === 'number' && typeof pos.historicalPeakCapital !== 'number';
        const staleAvg =
          (pos.id === 'pos-nvda-ndq' && pos.avgPrice === 31.1) ||
          (pos.id === 'pos-wt-gold-3x-mil' && pos.avgPrice === 40) ||
          (pos.id === 'pos-wt-nasdaq-3x-mil' && pos.avgPrice === 116.98);
        const staleTdgFlow =
          pos.id === 'pos-wt-nasdaq-3x-tdg' && pos.historicalNetCashFlow === -1187.5;

        if (missingFlow || missingPeak || staleAvg || staleTdgFlow) {
          patched = true;
          const totalValue = Number((pos.shares * pos.currentPrice).toFixed(2));
          const flow = audited.historicalNetCashFlow;
          const peak = audited.historicalPeakCapital;
          const unrealizedGainLoss = Number((totalValue + flow).toFixed(2));
          const denom = peak && peak > 0 ? peak : (flow < 0 ? Math.abs(flow) : Math.max(pos.shares * audited.avgPrice, 1));
          const unrealizedGainLossPct = Number(((unrealizedGainLoss / denom) * 100).toFixed(2));
          return {
            ...pos,
            avgPrice: audited.avgPrice,
            historicalNetCashFlow: flow,
            historicalPeakCapital: peak,
            unrealizedGainLoss,
            unrealizedGainLossPct,
          };
        }
      }
      return pos;
    });

    const isStaleNov20 =
      state.tradingAnalytics?.endDate === '20-11-2026' ||
      (typeof state.tradingAnalytics?.totalTrades === 'number' && state.tradingAnalytics.totalTrades === 2847);

    if (!patched && !isStaleNov20) return state;

    return {
      ...state,
      positions: fixedPositions,
      ...(isStaleNov20
        ? {
            cash: state.cash === 419.92 ? INITIAL_PORTFOLIO_STATE.cash : state.cash,
            tradingAnalytics: INITIAL_PORTFOLIO_STATE.tradingAnalytics,
          }
        : {}),
    };
  }

  /**
   * Loads the active portfolio state (tries cloud first if configured, then localStorage)
   */
  public static async getPortfolioState(): Promise<PortfolioState> {
    const cfg = this.getSavedConfig();
    if (cfg?.enabled && cfg.url && cfg.anonKey) {
      try {
        const res = await fetch(
          `${cfg.url}/rest/v1/portfolio_states?id=eq.${CLOUD_ROW_ID}&select=state,updated_at`,
          {
            method: 'GET',
            headers: buildHeaders(cfg.anonKey),
          }
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0 && rows[0].state) {
            const cloudState = this.enforceAuditedDegiroData(rows[0].state as PortfolioState);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudState));
            return cloudState;
          }
        }
      } catch (e) {
        console.warn('Error leyendo desde Supabase, usando copia local:', e);
      }
    }

    try {
      LEGACY_STORAGE_KEYS.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = this.enforceAuditedDegiroData(JSON.parse(stored) as PortfolioState);
        const hasLegacyMergedPositions = parsed.positions?.some(
          p => p.id === 'pos-wt-gold-3x' || (p.isin === 'IE00B8HGT870' && p.shares === 155)
        );

        if (!hasLegacyMergedPositions && parsed.positions && parsed.positions.length >= 7) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading from localStorage, using initial mock data', e);
    }
    return INITIAL_PORTFOLIO_STATE;
  }

  /**
   * Saves the portfolio state (both to localStorage and Supabase if connected)
   */
  public static async savePortfolioState(state: PortfolioState): Promise<void> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving portfolio state locally', e);
    }

    const cfg = this.getSavedConfig();
    if (cfg?.enabled && cfg.url && cfg.anonKey) {
      try {
        const nowIso = new Date().toISOString();
        const res = await fetch(`${cfg.url}/rest/v1/portfolio_states`, {
          method: 'POST',
          headers: buildHeaders(cfg.anonKey, {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          }),
          body: JSON.stringify({
            id: CLOUD_ROW_ID,
            state,
            updated_at: nowIso,
          }),
        });
        if (res.ok) {
          this.saveConfig({ ...cfg, lastSyncedAt: nowIso });
        }
      } catch (e) {
        console.warn('No se pudo sincronizar con Supabase:', e);
      }
    }
  }

  /**
   * Force push current state to cloud
   */
  public static async syncNow(state: PortfolioState): Promise<boolean> {
    const cfg = this.getSavedConfig();
    if (!cfg?.enabled || !cfg.url || !cfg.anonKey) return false;
    try {
      const nowIso = new Date().toISOString();
      const res = await fetch(`${cfg.url}/rest/v1/portfolio_states`, {
        method: 'POST',
        headers: buildHeaders(cfg.anonKey, {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        }),
        body: JSON.stringify({
          id: CLOUD_ROW_ID,
          state,
          updated_at: nowIso,
        }),
      });
      if (res.ok) {
        this.saveConfig({ ...cfg, lastSyncedAt: nowIso });
        return true;
      }
    } catch {}
    return false;
  }

  /**
   * Resets to initial mock data
   */
  public static async resetToDefault(): Promise<PortfolioState> {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    return INITIAL_PORTFOLIO_STATE;
  }
}
