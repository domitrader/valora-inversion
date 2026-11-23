import React from 'react';
import { MainTab } from '../types/portfolio';
import { Home, Compass, Star, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  notificationCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  notificationCount = 1,
}) => {
  const tabs: {
    id: MainTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    hasBadge?: boolean;
  }[] = [
    { id: 'inicio', label: 'Inicio', icon: Home },
    { id: 'explorar', label: 'Explorar', icon: Compass },
    { id: 'seguimiento', label: 'Seguimiento', icon: Star },
    { id: 'perfil', label: 'Perfil', icon: User, hasBadge: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto">
      <div className="bg-gradient-to-b from-white/95 to-[#F0F8FF]/98 dark:from-[#0B1221]/95 dark:to-[#080D18]/98 backdrop-blur-xl rounded-t-[28px] border-t border-sky-200/80 dark:border-slate-800/90 shadow-[0_-10px_32px_-12px_rgba(14,165,233,0.22)] dark:shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.6)] transition-colors duration-200">
        <div className="flex items-center justify-around h-[70px] px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all active:scale-95 group"
              >
                {/* Halo azulado luminoso en la pestaña activa */}
                {isActive && (
                  <span
                    className="pointer-events-none absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-gradient-to-b from-sky-400/20 via-sky-300/12 to-transparent dark:from-sky-500/20 dark:via-sky-500/10 blur-[2px]"
                    aria-hidden="true"
                  />
                )}

                <div className="relative mb-1 flex items-center justify-center">
                  <Icon
                    className={`w-[22px] h-[22px] transition-all duration-200 ${
                      isActive
                        ? 'text-sky-600 dark:text-sky-400 stroke-[2.4] fill-sky-500/20 drop-shadow-[0_2px_8px_rgba(14,165,233,0.45)]'
                        : 'text-[#16325C] dark:text-slate-400 stroke-[1.9] group-hover:text-sky-600 dark:group-hover:text-sky-300'
                    }`}
                  />
                  {tab.hasBadge && notificationCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-[0_2px_6px_rgba(16,185,129,0.45)] ring-2 ring-white dark:ring-slate-900">
                      {notificationCount}
                    </span>
                  )}
                </div>

                <span
                  className={`relative text-[11px] leading-tight transition-colors ${
                    isActive
                      ? 'text-sky-700 dark:text-sky-300 font-extrabold'
                      : 'text-[#16325C]/80 dark:text-slate-400 font-semibold group-hover:text-sky-700 dark:group-hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </span>

                {/* Barra inferior luminosa azulada en la pestaña activa */}
                {isActive && (
                  <span
                    className="absolute bottom-1 w-10 h-1 rounded-full bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 shadow-[0_0_10px_rgba(14,165,233,0.65)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
