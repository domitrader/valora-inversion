import React, { useState } from 'react';
import { PositionItem } from '../types/portfolio';
import { parseBrokerExport, BrokerImportResult } from '../utils/brokerParsers';
import { formatEUR } from '../utils/calculations';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building,
  Check,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface ImportPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPositions: (positions: PositionItem[], replaceAll: boolean, detectedCash?: number) => void;
}

// Ejemplo real de exportación de cartera de DEGIRO
const DEGIRO_REAL_SAMPLE = `Producto;Símbolo/ISIN;Cantidad;Precio de compra;Precio actual;Valor en EUR;P/G no realizada
NVIDIA CORP;NVDA / US67066G1040;12;112,40;129,72;1.556,64;+207,84
APPLE INC;AAPL / US0378331005;20;185,20;212,80;4.256,00;+552,00
REALTY INCOME CORP;O / US7561091049;65;49,15;52,40;3.406,00;+211,25
VANGUARD S&P 500 UCITS;VUSA / IE00B3XXRP09;45;81,30;94,65;4.259,25;+600,75
21SHARES BITCOIN CORE;2BTC / CH1199067674;110;17,20;18,55;2.040,50;+148,50`;

// Ejemplo real de exportación de MyInvestor (fondos, acciones y ETFs)
const MYINVESTOR_REAL_SAMPLE = `Nombre;ISIN;Tipo;Títulos/Participaciones;Precio medio;Importe invertido;Último precio;Valoración actual
Vanguard Global Stock Index Fund EUR Acc;IE00B03HD191;Fondo Indexado;42,158;280,10;11.808,45;315,20;13.288,20
iShares Core MSCI World UCITS ETF;IE00B4L5Y983;ETF;50;82,40;4.120,00;98,40;4.920,00
Enagás S.A.;ES0130960018;Acciones;150;14,10;2.115,00;13,45;2.017,50`;

export const ImportPortfolioModal: React.FC<ImportPortfolioModalProps> = ({
  isOpen,
  onClose,
  onImportPositions,
}) => {
  const [inputText, setInputText] = useState('');
  const [importResult, setImportResult] = useState<BrokerImportResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [replaceAll, setReplaceAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleProcessText = (text: string) => {
    setInputText(text);
    if (text.trim().length > 0) {
      const result = parseBrokerExport(text);
      setImportResult(result);
      // Por defecto seleccionar todas las posiciones válidas
      const ids = new Set(result.parsedPositions.map(p => p.id));
      setSelectedIds(ids);
    } else {
      setImportResult(null);
      setSelectedIds(new Set());
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      handleProcessText(content);
    };
    reader.readAsText(file);
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (!importResult) return;
    if (selectedIds.size === importResult.parsedPositions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(importResult.parsedPositions.map(p => p.id)));
    }
  };

    const handleConfirm = () => {
    if (!importResult) return;
    const itemsToImport = importResult.parsedPositions.filter(p => selectedIds.has(p.id));
    if (itemsToImport.length === 0) return;

    onImportPositions(itemsToImport, replaceAll, importResult.detectedCash);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Importador de Brokers</h3>
              <p className="text-xs text-slate-500">Compatible con DEGIRO, MyInvestor y CSV financiero</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zona de contenido scrolleable */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5">
          {/* Botones de plantilla de prueba con 1 click */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Prueba rápida con datos reales:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleProcessText(DEGIRO_REAL_SAMPLE)}
                className="flex-1 py-1.5 px-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors"
              >
                <Building className="w-3.5 h-3.5" />
                <span>Exportación DEGIRO</span>
              </button>
              <button
                type="button"
                onClick={() => handleProcessText(MYINVESTOR_REAL_SAMPLE)}
                className="flex-1 py-1.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Exportación MyInvestor</span>
              </button>
            </div>
          </div>

          {/* Zona de Drag & Drop o pegar texto */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-3 text-center transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
            }`}
          >
            <textarea
              rows={4}
              value={inputText}
              onChange={e => handleProcessText(e.target.value)}
              placeholder="Arrastra aquí tu archivo CSV o pega el texto copiado de DEGIRO / MyInvestor..."
              className="w-full text-xs font-mono bg-transparent border-0 focus:outline-none resize-none placeholder-slate-400"
            />
            <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Formatos aceptados: .csv, .txt, .tsv</span>
              <label className="cursor-pointer font-bold text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1">
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Subir archivo</span>
                <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>

          {/* Resumen del parseo */}
          {importResult && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white">
                    {importResult.detectedBroker}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {importResult.parsedPositions.length} activos detectados
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Total: <strong className="text-slate-900">{formatEUR(importResult.summary.totalValue)}</strong>
                </div>
              </div>

              {/* Botón seleccionar todos / deseleccionar */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  {selectedIds.size === importResult.parsedPositions.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
                <span className="text-slate-400 text-[11px]">
                  {selectedIds.size} de {importResult.parsedPositions.length} seleccionados
                </span>
              </div>

              {/* Lista interactiva de filas parseadas */}
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {importResult.parsedPositions.map(pos => {
                  const isChecked = selectedIds.has(pos.id);
                  return (
                    <div
                      key={pos.id}
                      onClick={() => toggleSelectRow(pos.id)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-colors ${
                        isChecked
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-slate-100/60 border-transparent opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isChecked
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{pos.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {pos.ticker} • {pos.shares} títulos @ {formatEUR(pos.avgPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mr-1">
                          {pos.type}
                        </span>
                        <span className="font-bold text-slate-900">{formatEUR(pos.totalValue)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Advertencias de líneas descartadas si existen */}
              {importResult.invalidLines.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Se omitieron {importResult.invalidLines.length} líneas que no correspondían a posiciones válidas (encabezados o saldo en efectivo).
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Opciones de fusión de cartera */}
          {importResult && (
            <div className="bg-slate-50 rounded-2xl p-3 text-xs space-y-2">
              <span className="font-bold text-slate-700 block">Modo de actualización:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReplaceAll(false)}
                  className={`flex-1 py-1.5 px-2 rounded-xl font-bold border transition-all ${
                    !replaceAll
                      ? 'bg-white border-emerald-500 text-emerald-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  Añadir / Fusionar
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceAll(true)}
                  className={`flex-1 py-1.5 px-2 rounded-xl font-bold border transition-all ${
                    replaceAll
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  Reemplazar cartera
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="pt-3 border-t border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!importResult || selectedIds.size === 0}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Importar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
