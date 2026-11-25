import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  X,
  Sparkles,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  Square,
  Radio,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { PortfolioState } from '../types/portfolio';
import {
  AssistantChatMessage,
  GeminiModelChoice,
  askDomingoAssistant,
  cleanTextForSpeech,
  getStoredGeminiApiKey,
  getStoredGeminiModel,
  setStoredGeminiApiKey,
  setStoredGeminiModel,
  validateGeminiApiKey,
} from '../services/geminiAssistantService';

interface GeminiVoiceAssistantProps {
  portfolioState: PortfolioState;
  lastUpdatedTime?: string;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

// Tipado compatible con Web Speech API en Chrome / Android / Safari / Edge
interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/**
 * Divide un texto largo en frases cortas (<175 caracteres) para evitar el corte de 15s de Chrome en Android.
 */
function splitIntoSpeechChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?;:\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length <= 175) {
      current = (current + ' ' + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= 175) {
        current = sentence;
      } else {
        // Si una oración aislada es muy larga, trocearla por comas o palabras
        const words = sentence.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= 175) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        current = sub;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Renderiza Markdown ligero (negritas y listas) de forma limpia y legible en móvil.
 */
const FormattedMessageText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  const renderInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-extrabold text-[#061838] dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {lines.map((rawLine, i) => {
        const line = rawLine.trim();
        if (!line) return <div key={i} className="h-1" />;

        if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
          const cleanHeading = line.replace(/^#{1,3}\s+/, '');
          return (
            <h4 key={i} className="font-black text-[13.5px] text-[#081C3E] dark:text-sky-200 pt-1">
              {renderInline(cleanHeading)}
            </h4>
          );
        }

        if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          const cleanBullet = line.replace(/^[-•*]\s+/, '');
          return (
            <div key={i} className="flex items-start gap-2 pl-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-2 shrink-0" />
              <span className="flex-1">{renderInline(cleanBullet)}</span>
            </div>
          );
        }

        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
};

const QUICK_VOICE_PROMPTS = [
  '¿Cómo va mi cartera hoy?',
  'Analiza mis riesgos y concentración',
  'Resumen de todas mis carteras',
  '¿Cuánto gané por años desde 2018?',
  '¿Cuánto llevo en dividendos y comisiones?',
  '¿Cuánto me falta para mi meta?',
];

export const GeminiVoiceAssistant: React.FC<GeminiVoiceAssistantProps> = ({
  portfolioState,
  lastUpdatedTime,
  externalOpen,
  onExternalOpenHandled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [keyDraft, setKeyDraft] = useState<string>(() => getStoredGeminiApiKey());
  const [selectedModel, setSelectedModel] = useState<GeminiModelChoice>(() => getStoredGeminiModel());
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'welcome-domingo',
      role: 'assistant',
      content:
        '¡Hola **Domingo**! Soy tu asistente personal con voz. Puedo analizar al instante tus carteras (**DEGIRO, MyInvestor, Coinbase, Bitvavo y BBVA**), tus posiciones en vivo, dividendos, comisiones y metas.\n\nToca el **micrófono** y háblame directamente.',
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      source: getStoredGeminiApiKey() ? 'gemini' : 'local',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Estados de Voz (Entrada + Salida + Manos Libres)
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const latestFullTranscriptRef = useRef<string>('');
  const audioUnlockedRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(handsFreeMode);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const isOpenRef = useRef<boolean>(isOpen);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const speechCancelRef = useRef<boolean>(false);

  // Desbloquea el motor de síntesis de voz en Safari iOS / Chrome Android en el primer toque del usuario
  const unlockMobileSpeech = useCallback(() => {
    if (audioUnlockedRef.current) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const silent = new SpeechSynthesisUtterance('');
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
        audioUnlockedRef.current = true;
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    handsFreeRef.current = handsFreeMode;
  }, [handsFreeMode]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (externalOpen) {
      setIsOpen(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen, onExternalOpenHandled]);

  // Auto-scroll suave al último mensaje
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, interimTranscript, isLoading, isOpen]);

  // Precargar voces del navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speechCancelRef.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // Cuando el usuario vuelve a pulsar el micro para terminar su frase y enviarla
  const finishListeningAndSubmit = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        stopListening();
      }
    }
  }, [stopListening]);

  // Al cerrar el panel, detener micro y voz
  const handleClosePanel = () => {
    stopListening();
    stopSpeaking();
    setHandsFreeMode(false);
    setIsOpen(false);
  };

  const pickBestSpanishVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
    if (!esVoices.length) return null;

    // Preferir voces naturales de España o Google / Microsoft Neural
    const preferred =
      esVoices.find((v) => v.lang === 'es-ES' && /natural|google|microsoft|alvaro|elvira|monica|jorge/i.test(v.name)) ||
      esVoices.find((v) => v.lang === 'es-ES') ||
      esVoices.find((v) => /google|natural/i.test(v.name)) ||
      esVoices[0];

    return preferred || null;
  };

  const speakOutLoud = useCallback(
    (rawText: string, onFinishedSpeaking?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onFinishedSpeaking?.();
        return;
      }

      window.speechSynthesis.cancel();
      speechCancelRef.current = false;

      const clean = cleanTextForSpeech(rawText);
      const chunks = splitIntoSpeechChunks(clean);
      if (!chunks.length) {
        onFinishedSpeaking?.();
        return;
      }

      const chosenVoice = pickBestSpanishVoice();
      setIsSpeaking(true);

      let index = 0;
      const speakNextChunk = () => {
        if (speechCancelRef.current || !isOpenRef.current || index >= chunks.length) {
          setIsSpeaking(false);
          if (!speechCancelRef.current && isOpenRef.current) {
            onFinishedSpeaking?.();
          }
          return;
        }

        const utter = new SpeechSynthesisUtterance(chunks[index]);
        utter.lang = chosenVoice?.lang || 'es-ES';
        if (chosenVoice) utter.voice = chosenVoice;
        utter.rate = 1.03;
        utter.pitch = 1.0;

        utter.onend = () => {
          index += 1;
          speakNextChunk();
        };

        utter.onerror = () => {
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utter);
      };

      speakNextChunk();
    },
    []
  );

  // Referencia adelantada para reiniciar escucha en modo manos libres
  const startListeningRef = useRef<() => void>(() => {});

  const handleSendQuery = useCallback(
    async (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      if (!trimmed || isLoading) return;

      unlockMobileSpeech();
      stopListening();
      stopSpeaking();
      setVoiceError(null);
      setInputText('');

      const userMsg: AssistantChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      };

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setIsLoading(true);

      try {
        const reply = await askDomingoAssistant({
          userMessage: trimmed,
          history: messages,
          portfolioState,
          lastUpdatedTime,
        });

        const assistantMsg: AssistantChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply.content,
          spokenText: reply.spokenText,
          timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          source: reply.source,
          modelUsed: reply.modelUsed,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);

        if (voiceEnabledRef.current && isOpenRef.current) {
          speakOutLoud(reply.content, () => {
            // Si está activo el Modo Manos Libres, volver a abrir el micrófono tras hablar
            if (handsFreeRef.current && isOpenRef.current) {
              setTimeout(() => {
                if (handsFreeRef.current && isOpenRef.current) {
                  startListeningRef.current();
                }
              }, 400);
            }
          });
        }
      } catch {
        setIsLoading(false);
        setVoiceError('No se pudo procesar la consulta. Inténtalo de nuevo.');
      }
    },
    [isLoading, messages, portfolioState, lastUpdatedTime, unlockMobileSpeech, stopListening, stopSpeaking, speakOutLoud]
  );

  const startListening = useCallback(() => {
    unlockMobileSpeech();
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setVoiceError('Tu navegador no soporta dictado por voz. Usa Chrome o Safari actualizado.');
      return;
    }

    // Si estaba hablando el asistente, lo callamos al instante para escuchar a Domingo
    stopSpeaking();
    stopListening();
    setVoiceError(null);
    finalTranscriptRef.current = '';
    latestFullTranscriptRef.current = '';
    setInterimTranscript('');

    try {
      const recognition = new RecognitionCtor();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        let interim = '';
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        if (finalChunk) {
          finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + finalChunk).trim();
        }
        const combined = (finalTranscriptRef.current + ' ' + interim).trim();
        latestFullTranscriptRef.current = combined;
        setInterimTranscript(combined);
      };

      recognition.onerror = (event: { error: string }) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoiceError('Permite el acceso al micrófono en tu navegador para poder hablar.');
          setHandsFreeMode(false);
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setVoiceError('No te he escuchado con claridad. Toca el micrófono otra vez.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        const captured = (finalTranscriptRef.current || latestFullTranscriptRef.current).trim();
        finalTranscriptRef.current = '';
        latestFullTranscriptRef.current = '';
        setInterimTranscript('');
        if (captured) {
          handleSendQuery(captured);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('No se pudo iniciar el micrófono. Prueba a tocar de nuevo.');
    }
  }, [handleSendQuery, unlockMobileSpeech, stopListening, stopSpeaking]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const handleSaveApiKey = async () => {
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      setStoredGeminiApiKey('');
      setApiKey('');
      setKeyStatusMsg({ type: 'ok', text: 'Clave borrada. Usando el Analista Local Gratuito.' });
      return;
    }

    setIsValidatingKey(true);
    setKeyStatusMsg(null);
    const check = await validateGeminiApiKey(trimmed);
    setIsValidatingKey(false);

    if (!check.valid) {
      setKeyStatusMsg({ type: 'err', text: check.error || 'Clave no válida.' });
      return;
    }

    setStoredGeminiApiKey(trimmed);
    setApiKey(trimmed);
    setKeyStatusMsg({
      type: 'ok',
      text: '¡Conectado con éxito a tu Gemini Gratis! Ya puedes preguntarle cualquier cosa por voz.',
    });
    setTimeout(() => {
      setShowKeyModal(false);
      setKeyStatusMsg(null);
    }, 1400);
  };

  const handleSelectModel = (model: GeminiModelChoice) => {
    setSelectedModel(model);
    setStoredGeminiModel(model);
  };

  return (
    <>
      {/* BOTÓN FLOTANTE DE VOZ GEMINI (Exclusivo Domingo · encima del menú inferior) */}
      {!isOpen && (
        <div className="fixed bottom-[82px] left-0 right-0 z-40 pointer-events-none max-w-md mx-auto px-4 flex justify-end">
          <button
            id="domingo-voice-assistant-fab"
            type="button"
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto group flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-full bg-gradient-to-r from-[#081C3E] via-[#0F2952] to-[#0284C7] text-white shadow-[0_10px_26px_-6px_rgba(2,132,199,0.55)] border border-sky-300/60 active:scale-95 transition-all hover:brightness-110"
            title="Hablar con tu Asistente Gemini por voz"
          >
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/15 border border-white/25">
              <Mic className="w-4 h-4 text-amber-300" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#081C3E]" />
            </span>
            <div className="text-left leading-none">
              <span className="block text-[11px] font-black tracking-tight">Voz Gemini</span>
              <span className="block text-[9px] text-sky-200 font-bold mt-0.5">Hablar gratis</span>
            </div>
          </button>
        </div>
      )}

      {/* PANEL COMPLETO DEL ASISTENTE DE VOZ DE DOMINGO */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end justify-center">
          <div className="w-full max-w-md h-[90vh] max-h-[820px] bg-[#F6FAFF] dark:bg-[#0B1221] rounded-t-[30px] shadow-2xl border-t border-x border-sky-200/90 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* CABECERA AZUL MARINO + CONTROLES DE VOZ Y LLAVE GRATUITA */}
            <header className="bg-gradient-to-r from-[#061838] via-[#0E2954] to-[#0369A1] text-white px-4 pt-3.5 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-white/12 border border-sky-300/35 flex items-center justify-center shrink-0 shadow-inner">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="text-[15px] font-black tracking-tight truncate">
                        Asistente Gemini · Domingo
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowKeyModal((v) => !v)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 transition"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          apiKey ? 'bg-emerald-400' : 'bg-amber-300'
                        }`}
                      />
                      <span>
                        {apiKey
                          ? `Gemini Gratis Activo (${selectedModel === 'gemini-2.5-pro' ? '2.5 Pro' : '2.5 Flash'})`
                          : 'Modo Local · Toca para conectar tu Gemini Gratis'}
                      </span>
                      <KeyRound className="w-2.5 h-2.5 text-amber-300 ml-0.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Silenciar / Activar respuesta hablada */}
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceEnabled) stopSpeaking();
                      setVoiceEnabled((v) => !v);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition ${
                      voiceEnabled
                        ? 'bg-emerald-500/20 border-emerald-300/40 text-emerald-300'
                        : 'bg-white/10 border-white/15 text-slate-300'
                    }`}
                    title={voiceEnabled ? 'Respuestas con voz activadas' : 'Voz silenciada'}
                  >
                    {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>

                  {/* Limpiar conversación */}
                  <button
                    type="button"
                    onClick={() => {
                      stopSpeaking();
                      setMessages([
                        {
                          id: `welcome-${Date.now()}`,
                          role: 'assistant',
                          content:
                            'Conversación reiniciada, **Domingo**. Toca el micrófono y dime qué quieres analizar de tus carteras.',
                          timestamp: new Date().toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                          source: apiKey ? 'gemini' : 'local',
                        },
                      ]);
                    }}
                    className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80"
                    title="Limpiar chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Cerrar */}
                  <button
                    type="button"
                    onClick={handleClosePanel}
                    className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white"
                    title="Cerrar asistente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Barra rápida de Modo Manos Libres + Estado de locución */}
              <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/12 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const next = !handsFreeMode;
                    setHandsFreeMode(next);
                    if (next && !isListening && !isSpeaking) {
                      startListening();
                    } else if (!next) {
                      stopListening();
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-extrabold transition ${
                    handsFreeMode
                      ? 'bg-emerald-400 text-[#061838] shadow-sm'
                      : 'bg-white/10 text-sky-100 hover:bg-white/20'
                  }`}
                >
                  <Radio className={`w-3.5 h-3.5 ${handsFreeMode ? 'animate-pulse' : ''}`} />
                  <span>{handsFreeMode ? 'Manos libres ACTIVO' : 'Modo Manos libres'}</span>
                </button>

                {isSpeaking ? (
                  <button
                    type="button"
                    onClick={stopSpeaking}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 text-[#061838] font-black animate-pulse"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Hablando… Toca para callar</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-sky-100/85 font-semibold truncate">
                    5 carteras · Historial 2018–2026 conectado
                  </span>
                )}
              </div>
            </header>

            {/* CAJA DESPLEGABLE PARA ACTIVAR GEMINI GRATIS EN 10 SEGUNDOS (0 €) */}
            {showKeyModal && (
              <div className="bg-white dark:bg-slate-900 border-b border-sky-200 dark:border-slate-800 p-4 shrink-0 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-[#061838] dark:text-white">
                      Conecta tu Google Gemini 100 % Gratis (0 € · Sin tarjeta)
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                      Tu clave se guarda únicamente en la memoria privada de este teléfono/navegador.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-extrabold hover:bg-sky-100 transition"
                >
                  <span>1. Abrir Google AI Studio y pulsar «Create API Key» (Gratis)</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder="2. Pega aquí tu clave gratuita (AIza...)"
                    className="flex-1 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    disabled={isValidatingKey}
                    onClick={handleSaveApiKey}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shrink-0 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {isValidatingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar</span>
                  </button>
                </div>

                {/* Selector de modelo gratuito */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-500">Modelo:</span>
                  {(
                    [
                      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Rápido · Gratis)' },
                      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Profundo)' },
                    ] as { id: GeminiModelChoice; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition ${
                        selectedModel === m.id
                          ? 'bg-[#081C3E] text-white border-[#081C3E] dark:bg-sky-600 dark:border-sky-500'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {keyStatusMsg && (
                  <div
                    className={`text-[11px] font-bold px-3 py-2 rounded-xl ${
                      keyStatusMsg.type === 'ok'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {keyStatusMsg.text}
                  </div>
                )}
              </div>
            )}

            {/* ZONA DE MENSAJES Y RESPUESTAS */}
            <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
              {/* Sugerencias rápidas táctiles */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_VOICE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendQuery(prompt)}
                    disabled={isLoading}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-sky-200/90 dark:border-slate-700 text-[11px] font-bold text-[#0F2952] dark:text-slate-200 hover:bg-sky-50 active:scale-95 transition shadow-2xs"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                        isUser
                          ? 'bg-gradient-to-br from-[#081C3E] to-[#0F3468] text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-sky-100 dark:border-slate-800 rounded-bl-sm'
                      }`}
                    >
                      {isUser ? (
                        <p className="text-[13px] font-semibold leading-snug">{msg.content}</p>
                      ) : (
                        <FormattedMessageText text={msg.content} />
                      )}

                      <div
                        className={`mt-1.5 pt-1 flex items-center justify-between gap-2 text-[10px] ${
                          isUser
                            ? 'text-sky-200/80'
                            : 'text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80'
                        }`}
                      >
                        <span>
                          {msg.timestamp}
                          {!isUser && msg.modelUsed ? ` · ${msg.modelUsed}` : ''}
                        </span>
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => speakOutLoud(msg.content)}
                            className="inline-flex items-center gap-1 font-extrabold text-sky-700 dark:text-sky-400 hover:underline"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Escuchar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Vista previa en vivo de lo que Domingo está diciendo por micrófono */}
              {isListening && (
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 bg-sky-100/90 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 text-[#081C3E] dark:text-sky-100">
                    <div className="flex items-center gap-2 text-[11px] font-black text-sky-700 dark:text-sky-300 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Escuchándote en español…</span>
                    </div>
                    <p className="text-[13px] italic">
                      {interimTranscript || 'Habla ahora con naturalidad…'}
                    </p>
                  </div>
                </div>
              )}

              {/* Indicador de análisis en curso */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 flex items-center gap-2.5 text-xs font-bold text-[#0F2952] dark:text-slate-200 shadow-xs">
                    <Loader2 className="w-4 h-4 text-sky-600 animate-spin" />
                    <span>Analizando tus carteras y datos auditados…</span>
                  </div>
                </div>
              )}

              {voiceError && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{voiceError}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* BARRA INFERIOR DE MICRÓFONO CENTRAL + TECLADO OPCIONAL */}
            <footer className="bg-white dark:bg-slate-900 border-t border-sky-200/80 dark:border-slate-800 px-3.5 pt-2.5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                {/* Botón grande protagonista de Micrófono */}
                <button
                  id="domingo-voice-mic-trigger"
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      finishListeningAndSubmit();
                    } else {
                      startListening();
                    }
                  }}
                  className={`relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-md active:scale-95 ${
                    isListening
                      ? 'bg-rose-600 text-white ring-4 ring-rose-200 dark:ring-rose-900/60 animate-pulse'
                      : 'bg-gradient-to-br from-[#081C3E] via-[#0F2952] to-[#0284C7] text-white hover:brightness-110'
                  }`}
                  title={isListening ? 'Terminar y enviar frase' : 'Tocar para hablar'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-amber-300" />}
                </button>

                {/* Entrada escrita opcional */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendQuery(inputText);
                  }}
                  className="flex-1 flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={isListening ? 'Escuchando tu voz…' : 'Toca el micro o escribe aquí…'}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-3 text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isLoading}
                    className="w-11 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition active:scale-95"
                    title="Enviar consulta"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};
