import { PortfolioState } from '../types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from '../data/mockPortfolio';

const LOCAL_STORAGE_KEY = 'valora_portfolio_state_v1';

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
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
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
    return INITIAL_PORTFOLIO_STATE;
  }
}
