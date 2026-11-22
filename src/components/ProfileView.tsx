import React, { useState, useEffect } from 'react';
import { PortfolioState } from '../types/portfolio';
import { portfolioService } from '../services/portfolioService';
import { SupabaseService } from '../services/supabaseService';
import { biometricService } from '../services/biometricService';
import {
  User,
  Shield,
  Coins,
  Briefcase,
  Upload,
  Download,
  RotateCcw,
  Plus,
  Check,
  ChevronRight,
  Database,
  CloudCheck,
  Info,
  Sun,
  Moon,
  Laptop,
  Lock,
  KeyRound,
  RefreshCw,
  Fingerprint,
} from 'lucide-react';

interface ProfileViewProps {
  portfolioState: PortfolioState;
  onUpdateCurrency: (currency: 'EUR' | 'USD' | 'GBP') => void;
  onUpdateTheme: (theme: 'light' | 'dark' | 'system') => void;
  onSwitchPortfolio: (portfolioId: string) => void;
  onAddPortfolio: (name: string) => void;
  onOpenImport: () => void;
  onResetDemo: () => void;
  onRestoreState: (state: PortfolioState) => void;
  hasPin?: boolean;
  onStartSetPin?: () => void;
  onDisablePin?: () => void;
  onLockNow?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  portfolioState,
  onUpdateCurrency,
  onUpdateTheme,
  onSwitchPortfolio,
  onAddPortfolio,
  onOpenImport,
  onResetDemo,
  onRestoreState,
  hasPin = false,
  onStartSetPin,
  onDisablePin,
  onLockNow,
}) => {
  const [newPortName, setNewPortName] = useState('');
  const [showAddPort, setShowAddPort] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(() => biometricService.isEnabled());

  useEffect(() => {
    biometricService.isAvailable().then(setBiometricAvailable);
  }, []);

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      biometricService.disable();
      setBiometricEnabled(false);
    } else {
      const ok = await biometricService.register('Domingo');
      if (ok) {
        setBiometricEnabled(true);
        alert('👆 Huella / Face ID activado correctamente en este dispositivo.');
      } else {
        alert('No se pudo activar la biometría en este navegador o fue cancelada.');
      }
    }
  };

  // Configuración de Supabase Gratis en la Nube
  const savedCloud = SupabaseService.getSavedConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(savedCloud?.url || '');
  const [supabaseKey, setSupabaseKey] = useState(savedCloud?.anonKey || '');
  const [cloudConnected, setCloudConnected] = useState(Boolean(savedCloud?.enabled));
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    setIsSyncingCloud(true);
    setCloudMessage('');
    const ok = await SupabaseService.init(supabaseUrl, supabaseKey);
    if (ok) {
      const pushed = await SupabaseService.syncNow(portfolioState);
      setCloudConnected(true);
      setCloudMessage(pushed ? '✅ Conectado y datos sincronizados en la nube.' : '✅ Conectado correctamente.');
    } else {
      setCloudConnected(false);
      setCloudMessage('⚠️ No se pudo conectar. Revisa la URL, la Anon Key o que la tabla SQL esté creada.');
    }
    setIsSyncingCloud(false);
  };

  const handleSyncCloudNow = async () => {
    setIsSyncingCloud(true);
    const ok = await SupabaseService.syncNow(portfolioState);
    setCloudMessage(ok ? '✅ Sincronización completada ahora mismo.' : '⚠️ Error al sincronizar con la nube.');
    setIsSyncingCloud(false);
  };

  const handleDisconnectSupabase = () => {
    SupabaseService.saveConfig(null);
    setCloudConnected(false);
    setCloudMessage('Desconectado de la nube (los datos siguen guardados en tu navegador).');
  };

  const handleExportBackup = () => {
    portfolioService.exportToJson(portfolioState);
  };

  const handleExportCsv = () => {
    const header = 'Producto;Ticker;ISIN;Tipo;Títulos;Precio Compra (EUR);Precio Actual (EUR);Valor Total (EUR);P/G No Realizada (EUR);Fecha Compra';
    const rows = portfolioState.positions.map(p => {
      const formatNum = (n: number) => n.toFixed(2).replace('.', ',');
      return [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        p.ticker || '',
        p.isin || '',
        p.type || '',
        p.shares.toString().replace('.', ','),
        formatNum(p.avgPrice),
        formatNum(p.currentPrice),
        formatNum(p.totalValue),
        formatNum(p.unrealizedGainLoss),
        p.purchaseDate || '',
      ].join(';');
    });
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartera_domingo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const content = ev.target?.result as string;
        const restored = portfolioService.importFromJson(content);
        onRestoreState(restored);
        alert('Copia de seguridad restaurada correctamente.');
      } catch (err: any) {
        alert('Error al restaurar: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* 1. Cabecera */}
      <header className="pt-1 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Perfil & Ajustes</h1>
        <p className="text-xs text-slate-500 font-medium">Configuración de cuenta, carteras y sincronización</p>
      </header>

      {/* 2. Tarjeta de Usuario */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs flex items-center gap-3.5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
          DO
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-slate-900 text-base">Domingo</h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
              Privada / Familiar
            </span>
          </div>
          <span className="text-xs text-slate-400">domingo151@gmail.com</span>
        </div>
      </div>

      {/* 2.5 Selector de Tema Visual (Claro / Oscuro AMOLED / Sistema) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-indigo-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">Tema Visual</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onUpdateTheme('light')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              (portfolioState.theme || 'light') === 'light'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Claro</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateTheme('dark')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              portfolioState.theme === 'dark'
                ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Oscuro</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateTheme('system')}
            className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
              portfolioState.theme === 'system'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Laptop className="w-3.5 h-3.5 text-slate-500" />
            <span>Auto</span>
          </button>
        </div>
      </div>

      {/* 3. Selector de Divisa Base */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-4 h-4 text-emerald-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">Divisa Base</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(['EUR', 'USD', 'GBP'] as const).map(cur => (
            <button
              key={cur}
              onClick={() => onUpdateCurrency(cur)}
              className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                portfolioState.currency === cur
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{cur === 'EUR' ? '€ EUR' : cur === 'USD' ? '$ USD' : '£ GBP'}</span>
              {portfolioState.currency === cur && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Gestión de Carteras */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">Tus Carteras</h3>
          </div>
          <button
            onClick={() => setShowAddPort(!showAddPort)}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        </div>

        {showAddPort && (
          <div className="mb-3 p-3 bg-slate-50 rounded-2xl flex gap-2">
            <input
              type="text"
              value={newPortName}
              onChange={e => setNewPortName(e.target.value)}
              placeholder="Nombre de la nueva cartera..."
              className="flex-1 text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => {
                if (newPortName.trim()) {
                  onAddPortfolio(newPortName.trim());
                  setNewPortName('');
                  setShowAddPort(false);
                }
              }}
              className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-emerald-700"
            >
              Crear
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          {portfolioState.portfolios.map(port => {
            const isSelected = portfolioState.activePortfolioId === port.id;
            return (
              <button
                key={port.id}
                onClick={() => onSwitchPortfolio(port.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs">{port.name}</div>
                  <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    Divisa: {port.currency} • Creada {port.createdAt}
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4.5. Seguridad & Clave PIN Familiar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">Clave de Acceso Seguro</h3>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              hasPin
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {hasPin ? 'PIN Activado' : 'Sin Protección'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
          Protege el acceso a tu cartera familiar en el móvil mediante un código numérico privado de 4 dígitos.
        </p>

        {hasPin ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onLockNow}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bloquear Ahora</span>
              </button>
              <button
                type="button"
                onClick={onStartSetPin}
                className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={onDisablePin}
                className="py-2 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors"
              >
                Desactivar
              </button>
            </div>

            {biometricAvailable && (
              <button
                type="button"
                onClick={handleToggleBiometric}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  biometricEnabled
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Fingerprint className="w-4 h-4 text-emerald-600" />
                <span>
                  {biometricEnabled ? 'Huella / Face ID Activado (Tocar para desactivar)' : 'Activar Desbloqueo con Huella / Face ID'}
                </span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onStartSetPin}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Configurar Clave PIN (4 dígitos)</span>
          </button>
        )}
      </div>

      {/* 5. Herramientas de Importación y Respaldo */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-4 shadow-xs space-y-2">
        <h3 className="font-extrabold text-slate-900 text-sm mb-2">Datos y Sincronización</h3>

        <button
          onClick={onOpenImport}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs font-bold text-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Importar desde DEGIRO / MyInvestor / CSV</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleExportCsv}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs font-bold text-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-blue-600" />
            <span>Exportar cartera a Excel / CSV</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          onClick={handleExportBackup}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs font-bold text-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-slate-500" />
            <span>Descargar copia de seguridad (JSON)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <label className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-slate-500" />
            <span>Restaurar copia de seguridad (JSON)</span>
          </div>
          <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </label>

        <button
          onClick={() => {
            if (confirm('¿Restablecer los datos demo originales? Se perderán las modificaciones locales no exportadas.')) {
              onResetDemo();
            }
          }}
          className="w-full text-left py-2.5 px-3 rounded-2xl hover:bg-rose-50 transition-colors flex items-center justify-between text-xs font-bold text-rose-600"
        >
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4" />
            <span>Restaurar datos de prueba iniciales</span>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>
      </div>

      {/* 6. Base de Datos en la Nube (Supabase Gratis 0 €/mes) */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 mb-4 shadow-sm text-xs space-y-3 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <Shield className="w-4 h-4" />
            <span>Base de Datos en la Nube (Supabase Gratis)</span>
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
            cloudConnected
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            {cloudConnected ? '🟢 Conectado' : '⚪ Solo Local'}
          </span>
        </div>

        <p className="text-slate-300 text-[11px] leading-relaxed">
          Conecta tu proyecto gratuito de <strong>Supabase</strong> (0 €/mes) para que todo lo que añadas manualmente no se pierda nunca aunque borres el historial del navegador o cambies de móvil.
        </p>

        {cloudMessage && (
          <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-[11px] font-semibold text-emerald-300">
            {cloudMessage}
          </div>
        )}

        <form onSubmit={handleConnectSupabase} className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Project URL</label>
            <input
              type="url"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Supabase Anon Public Key</label>
            <input
              type="password"
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={isSyncingCloud}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{cloudConnected ? 'Actualizar Conexión' : 'Conectar Nube Gratis'}</span>
            </button>

            {cloudConnected && (
              <>
                <button
                  type="button"
                  onClick={handleSyncCloudNow}
                  disabled={isSyncingCloud}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-slate-700 transition-colors"
                >
                  Guardar Ahora
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs border border-rose-800/50 transition-colors"
                >
                  Desconectar
                </button>
              </>
            )}
          </div>
        </form>

        <div className="pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowSqlGuide(v => !v)}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showSqlGuide ? 'Ocultar guía de configuración (1 minuto)' : '¿Cómo crear la tabla gratis en Supabase? Ver guía'}</span>
          </button>

          {showSqlGuide && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-300 space-y-1.5">
              <p>1. Crea una cuenta gratuita en <strong>supabase.com</strong> y crea un proyecto.</p>
              <p>2. Entra en <strong>SQL Editor</strong>, pega y ejecuta esto:</p>
              <pre className="bg-slate-900 p-2 rounded-lg text-[9px] text-emerald-300 overflow-x-auto font-mono select-all">
{`create table if not exists portfolio_states (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
alter table portfolio_states enable row level security;
create policy "public_access" on portfolio_states for all using (true) with check (true);`}
              </pre>
              <p>3. Copia tu <strong>Project URL</strong> y <strong>anon public key</strong> de <em>Project Settings → API</em> y pégalos arriba.</p>
            </div>
          )}
        </div>
      </div>

      {/* 7. Aviso legal */}
      <div className="text-[11px] text-slate-400 text-center leading-relaxed px-2">
        <p>Domingo Portafolio no constituye asesoramiento financiero ni recomendación de inversión. Las cotizaciones pueden sufrir ligeros retrasos según la bolsa de negociación.</p>
        <p className="mt-1 font-semibold text-slate-500">Versión 1.0.0 • Mobile-first PWA</p>
      </div>
    </div>
  );
};
