import { PortfolioState } from '../types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from '../data/mockPortfolio';

const LOCAL_STORAGE_KEY = 'valora_portfolio_state_v5';
const SUPABASE_CONFIG_KEY = 'valora_supabase_config_v1';
const CLOUD_ROW_ID = 'domingo_portfolio';

const DEFAULT_SUPABASE_URL = 'https://hveszaejunbguilywipu.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_V0QP2u2j3Ds_-cPTItsgBw_1RGlkerw';

// Legacy keys to clean up
const LEGACY_STORAGE_KEYS = [
  'valora_portfolio_state_v1',
  'valora_portfolio_state_v2',
  'valora_portfolio_state_v3',
  'valora_portfolio_state_v4'
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
            const cloudState: PortfolioState = rows[0].state;
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
        const parsed: PortfolioState = JSON.parse(stored);
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
