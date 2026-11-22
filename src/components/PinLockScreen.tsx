import React, { useState } from 'react';
import { Shield, Lock, Delete, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface PinLockScreenProps {
  storedPin: string;
  onUnlock: () => void;
  onSetPin?: (newPin: string) => void;
  isSettingPin?: boolean;
  onCancelSetup?: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  storedPin,
  onUnlock,
  onSetPin,
  isSettingPin = false,
  onCancelSetup,
}) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>(isSettingPin ? 'enter' : 'enter');
  const [firstEnteredPin, setFirstEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  const handleKeyPress = (digit: string) => {
    setErrorMsg('');
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);

      if (nextPin.length === 4) {
        // If validating existing PIN
        if (!isSettingPin) {
          if (nextPin === storedPin) {
            onUnlock();
          } else {
            triggerError('PIN incorrecto. Inténtalo de nuevo.');
          }
        } else {
          // If in setting PIN mode
          if (step === 'enter') {
            setFirstEnteredPin(nextPin);
            setEnteredPin('');
            setStep('confirm');
          } else if (step === 'confirm') {
            if (nextPin === firstEnteredPin) {
              if (onSetPin) onSetPin(nextPin);
            } else {
              triggerError('Los códigos no coinciden. Prueba de nuevo.');
              setStep('enter');
              setFirstEnteredPin('');
            }
          }
        }
      }
    }
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => {
      setEnteredPin('');
      setIsShaking(false);
    }, 600);
  };

  const handleDelete = () => {
    setErrorMsg('');
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setEnteredPin('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col justify-between items-center px-6 py-10 select-none">
      {/* Top Header */}
      <div className="w-full max-w-xs flex flex-col items-center text-center mt-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
          <Lock className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-black tracking-tight text-white">
          {isSettingPin
            ? step === 'enter'
              ? 'Crear Clave de Acceso'
              : 'Confirma tu Clave PIN'
            : 'Domingo — Acceso Seguro'}
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 max-w-[260px]">
          {isSettingPin
            ? step === 'enter'
              ? 'Elige un código PIN de 4 dígitos para proteger tu cartera'
              : 'Vuelve a introducir los 4 dígitos para confirmar'
            : 'Introduce tu PIN de 4 dígitos para ver el saldo y posiciones'}
        </p>

        {/* PIN Dots Display */}
        <div
          className={`flex items-center justify-center gap-4 mt-8 transition-transform duration-200 ${
            isShaking ? 'translate-x-2 animate-bounce' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = enteredPin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-[10px] font-bold ${
                  isFilled
                    ? 'bg-emerald-400 border-emerald-400 text-slate-950 scale-110 shadow-sm shadow-emerald-400/50'
                    : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                {isFilled && showNumbers ? enteredPin[idx] : ''}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg ? (
          <div className="flex items-center gap-1.5 mt-3 text-rose-400 text-xs font-semibold animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="h-6 mt-3" />
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3 mb-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            onClick={() => handleKeyPress(digit)}
            type="button"
            className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-800/80 text-xl font-extrabold text-white flex items-center justify-center transition-all shadow-sm"
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: visibility / clear, 0, delete */}
        <button
          onClick={() => setShowNumbers(!showNumbers)}
          type="button"
          className="h-16 rounded-2xl bg-transparent hover:bg-slate-900/40 text-slate-400 text-xs font-bold flex items-center justify-center transition-all"
        >
          {showNumbers ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>

        <button
          onClick={() => handleKeyPress('0')}
          type="button"
          className="h-16 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 border border-slate-800/80 text-xl font-extrabold text-white flex items-center justify-center transition-all shadow-sm"
        >
          0
        </button>

        <button
          onClick={handleDelete}
          type="button"
          className="h-16 rounded-2xl bg-transparent hover:bg-slate-900/40 text-slate-400 active:scale-95 flex items-center justify-center transition-all"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Footer / Cancel option */}
      {isSettingPin && onCancelSetup && (
        <button
          onClick={onCancelSetup}
          type="button"
          className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          Cancelar configuración
        </button>
      )}

      {!isSettingPin && (
        <div className="text-[11px] text-slate-500 font-medium">
          Privacidad local garantizada • Datos en el dispositivo
        </div>
      )}
    </div>
  );
};
