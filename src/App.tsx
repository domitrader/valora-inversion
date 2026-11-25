import React, { useState, useEffect, useCallback } from 'react';
import {
  PortfolioState,
  MainTab,
  AssetType,
  PositionItem,
  WatchlistItem,
  TimeRange,
  TradingAnalytics,
} from './types/portfolio';
import { INITIAL_PORTFOLIO_STATE } from './data/mockPortfolio';
import { SupabaseService } from './services/supabaseService';
import { BottomNav } from './components/BottomNav';
import { PortfolioView } from './components/PortfolioView';
import { EventsView } from './components/EventsView';
import { ExploreView } from './components/ExploreView';
import { WatchlistView } from './components/WatchlistView';
import { ProfileView } from './components/ProfileView';
import { SearchModalView } from './components/SearchModalView';
import { ImportPortfolioModal } from './components/ImportPortfolioModal';
import { PinLockScreen } from './components/PinLockScreen';
import { GeminiVoiceAssistant } from './components/GeminiVoiceAssistant';
import { liveQuotesService } from './services/liveQuotesService';

export const App: React.FC = () => {
  const [portfolioState, setPortfolioState] = useState<PortfolioState>(INITIAL_PORTFOLIO_STATE);
  const [activeTab, setActiveTab] = useState<MainTab>('inicio');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isRefreshingLive, setIsRefreshingLive] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');

  // Modals & Security state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchInitialCategory, setSearchInitialCategory] = useState<AssetType | undefined>(undefined);
  const [activeWatchlistListId, setActiveWatchlistListId] = useState<string>('default');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState<boolean>(false);

  // Security PIN lock state
  const [pinCode, setPinCode] = useState<string>(() => {
    try {
      return localStorage.getItem('valora_pin_code') || '';
    } catch {
      return '';
    }
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('valora_pin_code');
    } catch {
      return false;
    }
  });
  const [isSettingPin, setIsSettingPin] = useState<boolean>(false);

  const handleSetPin = (newPin: string) => {
    try {
      localStorage.setItem('valora_pin_code', newPin);
    } catch (e) {
      console.warn(e);
    }
    setPinCode(newPin);
    setIsSettingPin(false);
    setIsLocked(false);
    alert('🔐 PIN de seguridad activado. Te pedirá la clave cada vez que abras la web o vuelvas tras minimizarla.');
  };

  const handleDisablePin = () => {
    if (confirm('¿Seguro que deseas desactivar la clave PIN de acceso?')) {
      try {
        localStorage.removeItem('valora_pin_code');
      } catch (e) {
        console.warn(e);
      }
      setPinCode('');
      setIsLocked(false);
    }
  };

  const handleLockNow = () => {
    if (pinCode) {
      setIsLocked(true);
    }
  };

  // Auto-bloqueo al minimizar/cambiar de app en el móvil más de 20 segundos
  useEffect(() => {
    if (!pinCode) return;
    let hiddenAt = 0;
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt > 0 && Date.now() - hiddenAt > 20000) {
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pinCode]);

  // Initial load from storage / service + auto-refresh live quotes
  useEffect(() => {
    async function loadData() {
      const loaded = await SupabaseService.getPortfolioState();
      setPortfolioState(loaded);
      setIsLoaded(true);

      // Auto-actualización inmediata en segundo plano con precios en vivo
      if (loaded.positions && loaded.positions.length > 0) {
        setIsRefreshingLive(true);
        liveQuotesService
          .updateAllPositionsWithLiveMarketData(loaded.positions)
          .then(res => {
            if (res.updatedPositions && res.updatedPositions.length > 0) {
              setPortfolioState(prev => ({
                ...prev,
                positions: res.updatedPositions,
              }));
              setLastUpdatedTime(res.timestamp);
            }
          })
          .catch(err => console.warn('Error en auto-refresh inicial:', err))
          .finally(() => setIsRefreshingLive(false));
      }
    }
    loadData();
  }, []);

  // Auto-refresco en segundo plano cada 60 segundos mientras la app está abierta o al volver a la pestaña
  useEffect(() => {
    if (!isLoaded) return;

    const runAutoRefresh = async () => {
      if (document.hidden) return;
      try {
        const res = await liveQuotesService.updateAllPositionsWithLiveMarketData(portfolioState.positions);
        if (res.updatedPositions && res.updatedPositions.length > 0) {
          setPortfolioState(prev => ({
            ...prev,
            positions: res.updatedPositions,
          }));
          setLastUpdatedTime(res.timestamp);
        }
      } catch (err) {
        console.warn('Error en auto-refresco periódico:', err);
      }
    };

    const intervalId = window.setInterval(runAutoRefresh, 60000);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        runAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isLoaded, portfolioState.positions]);

  // Sync dark mode class to document element
  useEffect(() => {
    const theme = portfolioState.theme || 'light';
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [portfolioState.theme]);

  // Save to persistence whenever state changes
  useEffect(() => {
    if (isLoaded) {
      SupabaseService.savePortfolioState(portfolioState);
    }
  }, [portfolioState, isLoaded]);

  // Tab switching
  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open search with optional category pre-filtered
  const handleOpenSearch = (category?: AssetType) => {
    setSearchInitialCategory(category);
    setIsSearchOpen(true);
  };

  // Toggle hide figures
  const handleToggleHideFigures = () => {
    setPortfolioState((prev) => ({
      ...prev,
      hideFigures: !prev.hideFigures,
    }));
  };

  // Time range selection
  const handleSelectTimeRange = (range: TimeRange) => {
    setPortfolioState((prev) => ({
      ...prev,
      selectedTimeRange: range,
    }));
  };

  // Update available cash independently per portfolio
  const handleUpdateCash = (newCash: number) => {
    const cleanCash = Math.max(0, newCash);
    setPortfolioState((prev) => {
      const defaultPortId = prev.portfolios[0]?.id || 'port-main';
      const isDefault = prev.activePortfolioId === defaultPortId;
      return {
        ...prev,
        cash: isDefault ? cleanCash : prev.cash,
        portfolios: prev.portfolios.map((p) =>
          p.id === prev.activePortfolioId ? { ...p, cash: cleanCash } : p
        ),
      };
    });
  };

  // Update investment goal independently per portfolio
  const handleUpdateGoalAmount = (newGoal: number) => {
    const cleanGoal = Math.max(100, newGoal);
    setPortfolioState((prev) => {
      const defaultPortId = prev.portfolios[0]?.id || 'port-main';
      const isDefault = prev.activePortfolioId === defaultPortId;
      return {
        ...prev,
        goalAmount: isDefault ? cleanGoal : prev.goalAmount,
        portfolios: prev.portfolios.map((p) =>
          p.id === prev.activePortfolioId ? { ...p, goalAmount: cleanGoal } : p
        ),
      };
    });
  };

  // Update an existing position
  const handleUpdatePosition = (position: PositionItem) => {
    setPortfolioState((prev) => ({
      ...prev,
      positions: prev.positions.map((p) => (p.id === position.id ? position : p)),
    }));
  };

  // Delete a position
  const handleDeletePosition = (id: string) => {
    setPortfolioState((prev) => ({
      ...prev,
      positions: prev.positions.filter((p) => p.id !== id),
    }));
  };

  // Remove from watchlist
  const handleRemoveFromWatchlist = (id: string) => {
    setPortfolioState((prev) => ({
      ...prev,
      watchlist: prev.watchlist.filter((w) => w.id !== id),
    }));
  };

  // Add position to Portfolio from search
  const handleAddToPortfolio = (
    rawPos: Omit<
      PositionItem,
      'id' | 'totalValue' | 'unrealizedGainLoss' | 'unrealizedGainLossPct' | 'dailyChangeValue' | 'sparkline'
    >
  ) => {
    setPortfolioState((prev) => {
      const defaultPortId = prev.portfolios[0]?.id || 'port-main';
      const existingIndex = prev.positions.findIndex(
        (p) =>
          p.ticker.toUpperCase() === rawPos.ticker.toUpperCase() &&
          (p.portfolioId || defaultPortId) === prev.activePortfolioId
      );

      let updatedPositions: PositionItem[];
      if (existingIndex >= 0) {
        const existing = prev.positions[existingIndex];
        const newShares = existing.shares + rawPos.shares;
        const newTotalCost = existing.shares * existing.avgPrice + rawPos.shares * rawPos.avgPrice;
        const newAvgPrice = newTotalCost / (newShares || 1);
        const totalValue = newShares * rawPos.currentPrice;
        const unrealizedGainLoss = totalValue - newTotalCost;
        const unrealizedGainLossPct = (unrealizedGainLoss / (newTotalCost || 1)) * 100;
        const dailyChangeValue = newShares * (rawPos.currentPrice * (rawPos.dailyChangePct / 100));

        const updatedItem: PositionItem = {
          ...existing,
          shares: newShares,
          avgPrice: Number(newAvgPrice.toFixed(2)),
          currentPrice: rawPos.currentPrice,
          totalValue: Number(totalValue.toFixed(2)),
          unrealizedGainLoss: Number(unrealizedGainLoss.toFixed(2)),
          unrealizedGainLossPct: Number(unrealizedGainLossPct.toFixed(2)),
          dailyChangeValue: Number(dailyChangeValue.toFixed(2)),
        };
        updatedPositions = [...prev.positions];
        updatedPositions[existingIndex] = updatedItem;
      } else {
        const totalValue = rawPos.shares * rawPos.currentPrice;
        const totalCost = rawPos.shares * rawPos.avgPrice;
        const unrealizedGainLoss = totalValue - totalCost;
        const unrealizedGainLossPct = (unrealizedGainLoss / (totalCost || 1)) * 100;
        const dailyChangeValue = rawPos.shares * (rawPos.currentPrice * (rawPos.dailyChangePct / 100));

        const newPosition: PositionItem = {
          ...rawPos,
          id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          portfolioId: prev.activePortfolioId,
          totalValue: Number(totalValue.toFixed(2)),
          unrealizedGainLoss: Number(unrealizedGainLoss.toFixed(2)),
          unrealizedGainLossPct: Number(unrealizedGainLossPct.toFixed(2)),
          dailyChangeValue: Number(dailyChangeValue.toFixed(2)),
          sparkline: [
            rawPos.currentPrice * 0.98,
            rawPos.currentPrice * 0.99,
            rawPos.currentPrice * 1.01,
            rawPos.currentPrice,
          ],
        };
        updatedPositions = [newPosition, ...prev.positions];
      }

      return {
        ...prev,
        positions: updatedPositions,
      };
    });
  };

  const watchlistLists =
    portfolioState.watchlistLists && portfolioState.watchlistLists.length > 0
      ? portfolioState.watchlistLists
      : [{ id: 'default', name: 'Favoritos', createdAt: '2026-01-01' }];

  const handleCreateWatchlistList = (name: string) => {
    const newList = {
      id: `wlist-${Date.now()}`,
      name,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPortfolioState((prev) => {
      const base =
        prev.watchlistLists && prev.watchlistLists.length > 0
          ? prev.watchlistLists
          : [{ id: 'default', name: 'Favoritos', createdAt: '2026-01-01' }];
      return {
        ...prev,
        watchlistLists: [...base, newList],
      };
    });
    setActiveWatchlistListId(newList.id);
  };

  const handleDeleteWatchlistList = (listId: string) => {
    if (listId === 'default') return;
    setPortfolioState((prev) => ({
      ...prev,
      watchlistLists: (prev.watchlistLists || []).filter((l) => l.id !== listId),
      watchlist: prev.watchlist.filter((w) => (w.listId || 'default') !== listId),
    }));
    setActiveWatchlistListId('default');
  };

  const handleUpdateWatchlistItem = (updated: WatchlistItem) => {
    setPortfolioState((prev) => ({
      ...prev,
      watchlist: prev.watchlist.map((w) => (w.id === updated.id ? updated : w)),
    }));
  };

  // Add item to Watchlist / Simulated Portfolio from search (permite añadir por fechas y en distintas listas)
  const handleAddToWatchlist = (
    rawItem: Omit<WatchlistItem, 'id' | 'sparkline' | 'dailyChangeValue'>
  ) => {
    setPortfolioState((prev) => {
      const dailyChangeValue = rawItem.price * (rawItem.dailyChangePct / 100);
      const newWatchlistItem: WatchlistItem = {
        ...rawItem,
        id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        listId: rawItem.listId || activeWatchlistListId || 'default',
        dailyChangeValue: Number(dailyChangeValue.toFixed(2)),
        sparkline: [
          rawItem.price * 0.99,
          rawItem.price * 1.02,
          rawItem.price * 0.98,
          rawItem.price,
        ],
      };
      return {
        ...prev,
        watchlist: [newWatchlistItem, ...prev.watchlist],
      };
    });
  };

  // Import positions (DEGIRO CSV, MyInvestor or manual)
  const handleImportPositions = (
    newPositions: PositionItem[],
    replaceAll: boolean = false,
    detectedCash?: number,
    analytics?: TradingAnalytics
  ) => {
    setPortfolioState((prev) => ({
      ...prev,
      cash: detectedCash !== undefined ? detectedCash : prev.cash,
      tradingAnalytics: analytics || prev.tradingAnalytics,
      positions: replaceAll ? newPositions : [...newPositions, ...prev.positions],
    }));
  };

  // Currency change
  const handleUpdateCurrency = (currency: 'EUR' | 'USD' | 'GBP') => {
    setPortfolioState((prev) => ({
      ...prev,
      currency,
    }));
  };

  // Rename watchlist list
  const handleRenameWatchlistList = (listId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setPortfolioState((prev) => {
      const base =
        prev.watchlistLists && prev.watchlistLists.length > 0
          ? prev.watchlistLists
          : [{ id: 'default', name: 'Favoritos', createdAt: '2026-01-01' }];
      return {
        ...prev,
        watchlistLists: base.map((l) => (l.id === listId ? { ...l, name: clean } : l)),
      };
    });
  };

  // Portfolio switching
  const handleSwitchPortfolio = (portfolioId: string) => {
    setPortfolioState((prev) => ({
      ...prev,
      activePortfolioId: portfolioId,
    }));
  };

  // Add new portfolio (siempre empieza 100% limpia con 0,00 € de efectivo)
  const handleAddPortfolio = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const newPort = {
      id: `port-${Date.now()}`,
      name: clean,
      currency: portfolioState.currency,
      createdAt: new Date().toISOString(),
      cash: 0,
    };
    setPortfolioState((prev) => ({
      ...prev,
      portfolios: [...prev.portfolios, newPort],
      activePortfolioId: newPort.id,
    }));
  };

  // Rename any main portfolio (including DEGIRO)
  const handleRenamePortfolio = (portfolioId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setPortfolioState((prev) => ({
      ...prev,
      portfolios: prev.portfolios.map((p) => (p.id === portfolioId ? { ...p, name: clean } : p)),
    }));
  };

  // Delete extra main portfolio
  const handleDeletePortfolio = (portfolioId: string) => {
    setPortfolioState((prev) => {
      if (prev.portfolios.length <= 1) return prev;
      const remaining = prev.portfolios.filter((p) => p.id !== portfolioId);
      const nextActive = prev.activePortfolioId === portfolioId ? remaining[0].id : prev.activePortfolioId;
      return {
        ...prev,
        portfolios: remaining,
        activePortfolioId: nextActive,
        positions: prev.positions.filter((pos) => pos.portfolioId !== portfolioId),
      };
    });
  };

  // Theme change
  const handleUpdateTheme = (theme: 'light' | 'dark' | 'system') => {
    setPortfolioState((prev) => ({
      ...prev,
      theme,
    }));
  };

  // Reset to demo
  const handleResetDemo = async () => {
    const reset = await SupabaseService.resetToDefault();
    setPortfolioState(reset);
  };

  // Live quotes refresh
  const handleRefreshLiveQuotes = async () => {
    setIsRefreshingLive(true);
    try {
      const result = await liveQuotesService.updateAllPositionsWithLiveMarketData(portfolioState.positions);
      setPortfolioState(prev => ({
        ...prev,
        positions: result.updatedPositions,
      }));
      setLastUpdatedTime(result.timestamp);
    } catch (e) {
      console.error('Error al actualizar cotizaciones en vivo:', e);
    } finally {
      setIsRefreshingLive(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex justify-center selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Mobile-first centered frame container */}
      <div className="w-full max-w-md bg-white dark:bg-[#0B0F19] min-h-screen shadow-xl relative flex flex-col border-x border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200">
        {/* Render active screen */}
        <main className="flex-1">
          {activeTab === 'inicio' && (
            <PortfolioView
              positions={portfolioState.positions.filter(
                (p) =>
                  (p.portfolioId || portfolioState.portfolios[0]?.id || 'port-main') ===
                  portfolioState.activePortfolioId
              )}
              portfolios={portfolioState.portfolios}
              activePortfolioId={portfolioState.activePortfolioId}
              onSwitchPortfolio={handleSwitchPortfolio}
              onAddPortfolio={handleAddPortfolio}
              onRenamePortfolio={handleRenamePortfolio}
              onDeletePortfolio={handleDeletePortfolio}
              cash={(() => {
                const defaultPortId = portfolioState.portfolios[0]?.id || 'port-main';
                const activePort = portfolioState.portfolios.find(p => p.id === portfolioState.activePortfolioId);
                if (portfolioState.activePortfolioId === defaultPortId) {
                  return activePort?.cash !== undefined ? activePort.cash : portfolioState.cash;
                }
                return activePort?.cash ?? 0;
              })()}
              goalAmount={(() => {
                const activePort = portfolioState.portfolios.find(p => p.id === portfolioState.activePortfolioId);
                return activePort?.goalAmount ?? portfolioState.goalAmount;
              })()}
              hideFigures={portfolioState.hideFigures}
              selectedTimeRange={portfolioState.selectedTimeRange}
              events={portfolioState.events}
              tradingAnalytics={portfolioState.tradingAnalytics}
              onToggleHideFigures={handleToggleHideFigures}
              onSelectTimeRange={handleSelectTimeRange}
              onOpenSearch={() => handleOpenSearch()}
              onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
              onGoToProfile={() => handleTabChange('perfil')}
              onUpdateCash={handleUpdateCash}
              onUpdateGoalAmount={handleUpdateGoalAmount}
              onUpdatePosition={handleUpdatePosition}
              onDeletePosition={handleDeletePosition}
              onOpenImport={() => setIsImportOpen(true)}
              onRefreshLiveQuotes={handleRefreshLiveQuotes}
              isRefreshingLive={isRefreshingLive}
              lastUpdatedTime={lastUpdatedTime}
            />
          )}

          {activeTab === 'eventos' && (
            <EventsView
              events={portfolioState.events}
              positions={portfolioState.positions}
              hideFigures={portfolioState.hideFigures}
            />
          )}

          {activeTab === 'explorar' && (
            <ExploreView
              onSelectCategory={(cat) => handleOpenSearch(cat)}
              onOpenSearch={() => handleOpenSearch()}
              onGoToProfile={() => handleTabChange('perfil')}
            />
          )}

          {activeTab === 'seguimiento' && (
            <WatchlistView
              watchlist={portfolioState.watchlist}
              watchlistLists={watchlistLists}
              activeListId={activeWatchlistListId}
              onSelectList={setActiveWatchlistListId}
              onCreateList={handleCreateWatchlistList}
              onRenameList={handleRenameWatchlistList}
              onDeleteList={handleDeleteWatchlistList}
              onUpdateWatchlistItem={handleUpdateWatchlistItem}
              onOpenSearch={() => handleOpenSearch()}
              onGoToProfile={() => handleTabChange('perfil')}
              onRemoveFromWatchlist={handleRemoveFromWatchlist}
            />
          )}

          {activeTab === 'perfil' && (
            <ProfileView
              portfolioState={portfolioState}
              onUpdateCurrency={handleUpdateCurrency}
              onUpdateTheme={handleUpdateTheme}
              onSwitchPortfolio={handleSwitchPortfolio}
              onAddPortfolio={handleAddPortfolio}
              onOpenImport={() => setIsImportOpen(true)}
              onResetDemo={handleResetDemo}
              onRestoreState={setPortfolioState}
              hasPin={!!pinCode}
              onStartSetPin={() => setIsSettingPin(true)}
              onDisablePin={handleDisablePin}
              onLockNow={handleLockNow}
            />
          )}
        </main>

        {/* Asistente de Voz Gemini Exclusivo de Domingo (oculto si el PIN está bloqueado) */}
        {!isLocked && !isSettingPin && (
          <GeminiVoiceAssistant
            portfolioState={portfolioState}
            lastUpdatedTime={lastUpdatedTime}
            externalOpen={isVoiceAssistantOpen}
            onExternalOpenHandled={() => setIsVoiceAssistantOpen(false)}
          />
        )}

        {/* Fixed 4-tab bottom navigation */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          notificationCount={1}
        />

        {/* Search Modal */}
        {isSearchOpen && (
          <SearchModalView
            onClose={() => setIsSearchOpen(false)}
            initialCategory={searchInitialCategory}
            defaultAddMode={activeTab === 'seguimiento' ? 'watchlist' : 'portfolio'}
            watchlistLists={watchlistLists}
            activeWatchlistListId={activeWatchlistListId}
            onAddToPortfolio={handleAddToPortfolio}
            onAddToWatchlist={handleAddToWatchlist}
          />
        )}

        {/* Import Portfolio Modal (DEGIRO / CSV) */}
        <ImportPortfolioModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportPositions={handleImportPositions}
        />

        {/* Pin Lock Screen (Locked) */}
        {isLocked && pinCode && (
          <PinLockScreen
            storedPin={pinCode}
            onUnlock={() => setIsLocked(false)}
          />
        )}

        {/* Pin Setup Screen */}
        {isSettingPin && (
          <PinLockScreen
            storedPin=""
            isSettingPin={true}
            onSetPin={handleSetPin}
            onCancelSetup={() => setIsSettingPin(false)}
            onUnlock={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default App;
