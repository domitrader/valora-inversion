import React from 'react';
import { MainTab } from '../types/portfolio';
import { Home, Calendar, Search, Star } from 'lucide-react';

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
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 max-w-md mx-auto transition-colors duration-200">
      <div className="flex items-center justify-around h-16 px-1">
        {/* 1. Inicio */}
        <button
          onClick={() => onChangeTab('inicio')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'inicio' ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 mb-1 ${activeTab === 'inicio' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Inicio</span>
        </button>

        {/* 2. Eventos */}
        <button
          onClick={() => onChangeTab('eventos')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'eventos' ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Calendar className={`w-5 h-5 mb-1 ${activeTab === 'eventos' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Eventos</span>
        </button>

        {/* 3. Explorar */}
        <button
          onClick={() => onChangeTab('explorar')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'explorar' ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Search className={`w-5 h-5 mb-1 ${activeTab === 'explorar' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Explorar</span>
        </button>

        {/* 4. Seguimiento */}
        <button
          onClick={() => onChangeTab('seguimiento')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'seguimiento' ? 'text-slate-950 dark:text-white font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium'
          }`}
        >
          <Star className={`w-5 h-5 mb-1 ${activeTab === 'seguimiento' ? 'stroke-[2.5] fill-slate-950/10 dark:fill-white/10' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Seguimiento</span>
        </button>

        {/* 5. Perfil con Avatar & Badge */}
        <button
          onClick={() => onChangeTab('perfil')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
            activeTab === 'perfil' ? 'text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <div className="relative mb-1">
            <div
              className={`w-5 h-5 rounded-full overflow-hidden border flex items-center justify-center text-[10px] font-bold bg-gradient-to-tr from-slate-800 to-slate-600 text-white shadow-xs ${
                activeTab === 'perfil' ? 'border-slate-950 ring-2 ring-slate-950/15' : 'border-slate-300'
              }`}
            >
              CM
            </div>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-emerald-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {notificationCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">Perfil</span>
        </button>
      </div>
    </nav>
  );
};
