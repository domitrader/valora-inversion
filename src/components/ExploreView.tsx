import React, { useState } from 'react';
import { AssetType, NewsItem } from '../types/portfolio';
import { MOCK_NEWS } from '../data/mockPortfolio';
import {
  Menu,
  Edit3,
  Zap,
  Search,
  ArrowUp,
  ArrowRight,
  TrendingUp,
  Coins,
  Building2,
  PieChart,
  Bot,
  Sparkles,
  X,
} from 'lucide-react';

interface ExploreViewProps {
  onSelectCategory: (type: AssetType) => void;
  onOpenSearch: () => void;
  onGoToProfile: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  onSelectCategory,
  onOpenSearch,
  onGoToProfile,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [aiAnswers, setAiAnswers] = useState<{ query: string; answer: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newsList] = useState<NewsItem[]>(MOCK_NEWS);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // Asistente financiero inteligente
  const handleAskFinancialAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    const q = queryInput.trim();
    setIsProcessing(true);

    setTimeout(() => {
      let answer = '';
      const lower = q.toLowerCase();

      if (lower.includes('dividendo') && (lower.includes('realty') || lower.includes('o'))) {
        answer = 'Realty Income (NYSE: O) reparte dividendos mensualmente de manera ininterrumpida desde hace más de 30 años. Su rentabilidad por dividendo actual ronda el 5,6% anual con un pay-out ratio sobre AFFO cercano al 75%.';
      } else if (lower.includes('etf') && lower.includes('s&p 500')) {
        answer = 'Para inversores europeos, los ETFs UCITS más eficientes sobre el S&P 500 son iShares Core S&P 500 (CSPX / SXR8, TER 0,07%) y Vanguard S&P 500 (VUSA / VUAA, TER 0,07%). La versión acumulativa no tributa en España hasta la venta final.';
      } else if (lower.includes('impuesto') || lower.includes('hacienda') || lower.includes('tributan') || lower.includes('españa')) {
        answer = 'En España, las plusvalías y dividendos tributan en la base del ahorro por tramos: 19% hasta 6.000 €, 21% de 6.000 € a 50.000 €, 23% de 50.000 € a 200.000 €, 27% de 200.000 € a 300.000 € y 28% a partir de 300.000 €. Existe convenio de doble imposición con retención en origen del 15% para EE.UU. (W-8BEN).';
      } else if (lower.includes('bitcoin') || lower.includes('cripto') || lower.includes('btc')) {
        answer = 'Bitcoin opera como reserva de valor digital descentralizada y commodity digital con emisión fija máxima de 21 millones de monedas. Su volatilidad histórica es superior a la renta variable pero ofrece correlación diferenciada en carteras globales.';
      } else {
        answer = `Análisis para "${q}": Te recomendamos diversificar por clases de activo (Acciones, ETFs y Criptoactivos), mantener un fondo de emergencia en liquidez remunerada y reinvertir dividendos de forma periódica con la regla del interés compuesto.`;
      }

      setAiAnswers(prev => [{ query: q, answer }, ...prev]);
      setQueryInput('');
      setIsProcessing(false);
    }, 600);
  };

  return (
    <div className="pb-28 pt-2 px-4 max-w-md mx-auto">
      {/* 1. Cabecera idéntica a la captura de pantalla: menú, lápiz, rayo 5, avatar */}
      <header className="flex items-center justify-between pt-1 pb-4">
        <button
          onClick={() => alert('Menú de configuración y navegación rápida')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors"
            title="Crear o editar notas financieras"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Racha / energía con rayo y número 5 */}
          <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 text-amber-800 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-2xs">
            <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>5</span>
          </div>

          {/* Avatar de usuario */}
          <button
            onClick={onGoToProfile}
            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center hover:bg-slate-200 transition-colors shadow-xs"
          >
            DO
          </button>
        </div>
      </header>

      {/* 2. Gran titular multilínea idéntico a la captura de pantalla */}
      <section className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-950 leading-tight">
          Busca acciones<br />
          o haz cualquier pregunta<br />
          financiera
        </h1>
      </section>

      {/* 3. Tarjetas horizontales ("Buscar", "Noticias", "Tendencias") */}
      <section className="mb-6">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {/* Tarjeta 1: "Buscar" con Acciones, ETFs, Cripto */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-4 w-44 shrink-0 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="font-extrabold text-slate-900 text-base">Buscar</span>
              <Search className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => onSelectCategory('Acciones')}
                className="flex items-center gap-2.5 w-full text-left text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span>Acciones</span>
              </button>

              <button
                onClick={() => onSelectCategory('ETFs')}
                className="flex items-center gap-2.5 w-full text-left text-xs font-bold text-slate-800 hover:text-amber-600 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <PieChart className="w-3.5 h-3.5" />
                </div>
                <span>ETFs</span>
              </button>

              <button
                onClick={() => onSelectCategory('Fondos')}
                className="flex items-center gap-2.5 w-full text-left text-xs font-bold text-slate-800 hover:text-emerald-600 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <span>Fondos MyInvestor</span>
              </button>

              <button
                onClick={() => onSelectCategory('Cripto')}
                className="flex items-center gap-2.5 w-full text-left text-xs font-bold text-slate-800 hover:text-purple-600 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-fuchsia-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <span>Cripto</span>
              </button>
            </div>
          </div>

          {/* Tarjeta 2: "Noticias" con logotipos superpuestos y flecha */}
          <div
            onClick={() => setSelectedNews(newsList[0])}
            className="bg-white border border-slate-200/90 rounded-3xl p-4 w-44 shrink-0 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-300 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-extrabold text-slate-900 text-base">Noticias</span>
              <span className="text-slate-400 text-xs">📡</span>
            </div>

            {/* Logotipos solapados idénticos al screenshot */}
            <div className="flex items-center -space-x-2 my-2 overflow-hidden py-1">
              <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                NV
              </div>
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                AS
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                SP
              </div>
              <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                B
              </div>
              <div className="w-7 h-7 rounded-full bg-rose-700 text-white text-[9px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                TSC
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Tarjeta 3: "Top Dividendos" */}
          <div
            onClick={() => onSelectCategory('Acciones')}
            className="bg-white border border-slate-200/90 rounded-3xl p-4 w-44 shrink-0 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-300 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-slate-900 text-base">Renta Alta</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Activos con rentabilidad por dividendo sostenida superior al 5% anual.
            </p>
            <div className="mt-2 text-xs font-bold text-emerald-600">
              Explorar lista →
            </div>
          </div>
        </div>
      </section>

      {/* 4. Respuestas del Asistente Financiero IA si el usuario hace preguntas */}
      {aiAnswers.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-emerald-600" />
            <span>Consultas Inteligentes</span>
          </h2>
          {aiAnswers.map((item, idx) => (
            <div key={idx} className="bg-slate-900 text-white rounded-2xl p-4 shadow-md text-xs space-y-2">
              <div className="font-bold text-emerald-400 flex items-center gap-1">
                <span>Q:</span> {item.query}
              </div>
              <div className="text-slate-200 leading-relaxed">
                {item.answer}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 5. Titular y Feed de Noticias */}
      <section className="mb-20">
        <h2 className="font-extrabold text-lg text-slate-900 mb-3">Actualidad del mercado</h2>
        <div className="space-y-2.5">
          {newsList.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedNews(item)}
              className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:border-slate-300 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-bold text-slate-600">{item.source}</span>
                <span>{item.timeAgo}</span>
              </div>
              <h3 className="font-bold text-slate-900 text-xs leading-snug mb-1.5">{item.title}</h3>
              <div className="flex items-center gap-1.5">
                {item.relatedTickers.map(t => (
                  <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    ${t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Barra inferior fija/flotante de búsqueda idéntica a la captura ("Busca o pregunta lo que quieras" con flecha ↑) */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 z-30 pointer-events-none">
        <form
          onSubmit={handleAskFinancialAI}
          className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-300 rounded-full pl-5 pr-2 py-1.5 shadow-lg flex items-center justify-between gap-2"
        >
          <input
            type="text"
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder="Busca o pregunta lo que quieras"
            className="w-full text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          <button
            type="submit"
            disabled={isProcessing || !queryInput.trim()}
            className="w-9 h-9 rounded-full bg-slate-300 hover:bg-slate-900 hover:text-white text-slate-700 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
            title="Enviar consulta financiera"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      </div>

      {/* Modal Noticia completa */}
      {selectedNews && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-emerald-600">{selectedNews.source} • {selectedNews.timeAgo}</span>
              <button onClick={() => setSelectedNews(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm mb-3 leading-snug">{selectedNews.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">{selectedNews.summary}</p>
            <button
              onClick={() => setSelectedNews(null)}
              className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
