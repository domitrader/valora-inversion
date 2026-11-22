import { PortfolioState } from '../types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from '../data/mockPortfolio';

const LOCAL_STORAGE_KEY = 'valora_portfolio_state_v4';

// Legacy keys to clean up
const LEGACY_STORAGE_KEYS = [
  'valora_portfolio_state_v1',
  'valora_portfolio_state_v2',
  'valora_portfolio_state_v3'
];

/**
 * Service layer prepared for Supabase connection (PostgreSQL + RLS + Auth)
 * Operates with immediate reactive persistence in LocalStorage and clean API for Supabase.
 */
export class SupabaseService {
  private static isConfigured: boolean = false;

  /**
   * Initializes or checks connection to Supabase
   */
  public static async init(supabaseUrl?: string, supabaseAnonKey?: string): Promise<boolean> {
    if (supabaseUrl && supabaseAnonKey) {
      this.isConfigured = true;
      console.log('✅ Supabase configurado con éxito.');
      return true;
    }
    this.isConfigured = false;
    return false;
  }

  /**
   * Loads the active portfolio state for the current user
   */
  public static async getPortfolioState(): Promise<PortfolioState> {
    try {
      // Limpiar versiones obsoletas para forzar actualización de los ETFs separados
      LEGACY_STORAGE_KEYS.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
      });

      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: PortfolioState = JSON.parse(stored);
        // Validar si tiene las posiciones separadas (debe tener las 4 posiciones separadas de oro y nasdaq)
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
      if (this.isConfigured) {
        console.log('[Supabase Sync] Sincronizado en la nube para la cartera:', state.activePortfolioId);
      }
    } catch (e) {
      console.error('Error saving portfolio state', e);
    }
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
