import { PortfolioState, PositionItem, WatchlistItem, FinancialEvent } from '../types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from '../data/mockPortfolio';

const STORAGE_KEY = 'valora_portfolio_state_v6';

/**
 * Servicio de almacenamiento desacoplado con arquitectura limpia.
 * Actualmente persiste en localStorage para pruebas instantáneas sin fricción,
 * y expone la interfaz preparada para conectar Supabase Auth & PostgreSQL con RLS.
 */
export const portfolioService = {
  /**
   * Carga el estado de la cartera desde localStorage o devuelve los datos por defecto.
   */
  loadState(): PortfolioState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_PORTFOLIO_STATE,
          ...parsed,
          // Asegurar que si faltan arrays existan
          positions: parsed.positions || INITIAL_PORTFOLIO_STATE.positions,
          watchlist: parsed.watchlist || INITIAL_PORTFOLIO_STATE.watchlist,
          events: parsed.events || INITIAL_PORTFOLIO_STATE.events,
        };
      }
    } catch (e) {
      console.warn('Error al cargar estado de localStorage:', e);
    }
    return INITIAL_PORTFOLIO_STATE;
  },

  /**
   * Guarda el estado actual en localStorage.
   */
  saveState(state: PortfolioState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Error al guardar estado de cartera:', e);
    }
  },

  /**
   * Restablece los datos de prueba iniciales de la app.
   */
  resetToDemo(): PortfolioState {
    localStorage.removeItem(STORAGE_KEY);
    return INITIAL_PORTFOLIO_STATE;
  },

  /**
   * Exporta todos los datos a un archivo JSON descargable para copias de seguridad.
   */
  exportToJson(state: PortfolioState): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `valora-cartera-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * Valida e importa un JSON exportado previamente.
   */
  importFromJson(jsonString: string): PortfolioState {
    const parsed = JSON.parse(jsonString);
    if (!parsed.positions || !Array.isArray(parsed.positions)) {
      throw new Error('El archivo no contiene un formato de cartera Valora válido');
    }
    return {
      ...INITIAL_PORTFOLIO_STATE,
      ...parsed,
    };
  }
};

/**
 * Esquema de base de datos Supabase recomendado para persistencia multiusuario con RLS:
 * 
 * -- 1. Tabla de perfiles de usuario
 * create table public.profiles (
 *   id uuid references auth.users not null primary key,
 *   full_name text,
 *   avatar_url text,
 *   base_currency text default 'EUR',
 *   created_at timestamptz default now()
 * );
 * alter table public.profiles enable row level security;
 * create policy "Los usuarios pueden ver y editar solo su perfil"
 *   on public.profiles for all using (auth.uid() = id);
 * 
 * -- 2. Tabla de carteras
 * create table public.portfolios (
 *   id uuid default gen_random_uuid() primary key,
 *   user_id uuid references auth.users not null,
 *   name text not null,
 *   currency text default 'EUR',
 *   cash numeric default 0,
 *   goal_amount numeric default 25000,
 *   created_at timestamptz default now()
 * );
 * alter table public.portfolios enable row level security;
 * create policy "Usuarios gestionan sus propias carteras"
 *   on public.portfolios for all using (auth.uid() = user_id);
 * 
 * -- 3. Tabla de posiciones
 * create table public.positions (
 *   id uuid default gen_random_uuid() primary key,
 *   portfolio_id uuid references public.portfolios on delete cascade not null,
 *   ticker text not null,
 *   name text not null,
 *   isin text,
 *   asset_type text not null,
 *   shares numeric not null,
 *   avg_price numeric not null,
 *   current_price numeric not null,
 *   updated_at timestamptz default now()
 * );
 * alter table public.positions enable row level security;
 * create policy "Usuarios gestionan posiciones de sus carteras"
 *   on public.positions for all using (
 *     exists (select 1 from public.portfolios p where p.id = positions.portfolio_id and p.user_id = auth.uid())
 *   );
 */
export interface SupabaseConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
