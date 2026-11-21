import React, { useState, useEffect } from 'react';
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
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);

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

  // Initial load from storage / service
  useEffect(() => {
    async function loadData() {
      const loaded = await SupabaseService.getPortfolioState();
      setPortfolioState(loaded);
      setIsLoaded(true);
    }
    loadData();
  }, []);

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

  // Update available cash
  const handleUpdateCash = (newCash: number) => {
    setPortfolioState((prev) => ({
      ...prev,
      cash: Math.max(0, newCash),
    }));
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
      const existingIndex = prev.positions.findIndex(
        (p) => p.ticker.toUpperCase() === rawPos.ticker.toUpperCase()
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

  // Add item to Watchlist from search
  const handleAddToWatchlist = (
    rawItem: Omit<WatchlistItem, 'id' | 'sparkline' | 'dailyChangeValue'>
  ) => {
    setPortfolioState((prev) => {
      if (prev.watchlist.some((w) => w.ticker.toUpperCase() === rawItem.ticker.toUpperCase())) {
        return prev;
      }
      const dailyChangeValue = rawItem.price * (rawItem.dailyChangePct / 100);
      const newWatchlistItem: WatchlistItem = {
        ...rawItem,
        id: `watch-${Date.now()}`,
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

  // Portfolio switching
  const handleSwitchPortfolio = (portfolioId: string) => {
    setPortfolioState((prev) => ({
      ...prev,
      activePortfolioId: portfolioId,
    }));
  };

  // Add new portfolio
  const handleAddPortfolio = (name: string) => {
    const newPort = {
      id: `port-${Date.now()}`,
      name,
      currency: portfolioState.currency,
      createdAt: new Date().toISOString(),
    };
    setPortfolioState((prev) => ({
      ...prev,
      portfolios: [...prev.portfolios, newPort],
      activePortfolioId: newPort.id,
    }));
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
              positions={portfolioState.positions}
              cash={portfolioState.cash}
              goalAmount={portfolioState.goalAmount}
              hideFigures={portfolioState.hideFigures}
              selectedTimeRange={portfolioState.selectedTimeRange}
              events={portfolioState.events}
              tradingAnalytics={portfolioState.tradingAnalytics}
              onToggleHideFigures={handleToggleHideFigures}
              onSelectTimeRange={handleSelectTimeRange}
              onOpenSearch={() => handleOpenSearch()}
              onGoToProfile={() => handleTabChange('perfil')}
              onUpdateCash={handleUpdateCash}
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

        {/* Fixed 5-tab bottom navigation */}
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
