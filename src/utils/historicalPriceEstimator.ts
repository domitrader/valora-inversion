import { CatalogAsset } from '../data/comprehensiveAssetCatalog';

/**
 * Formatea una fecha YYYY-MM-DD a formato amigable en español (ej: "1 de enero de 2025")
 */
export function formatDateToSpanish(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} de ${months[monthIdx]} de ${year}`;
      }
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Estima el precio histórico aproximado de un activo en una fecha determinada (ej: 01/01/2025).
 * Si el activo tiene hitos históricos registrados (historicalAnchors), interpola con precisión.
 * En caso contrario, aplica una tasa compuesta de descuento temporal según la clase de activo.
 */
export function estimateHistoricalPrice(
  asset: Pick<CatalogAsset, 'price' | 'historicalAnchors' | 'type'>,
  dateStr: string
): {
  estimatedPrice: number;
  explanation: string;
  formattedDate: string;
} {
  const formattedDate = formatDateToSpanish(dateStr);
  const currentPrice = asset.price || 10;

  if (!dateStr) {
    return {
      estimatedPrice: currentPrice,
      explanation: 'Precio actual de cotización',
      formattedDate: 'Hoy',
    };
  }

  const targetDate = new Date(dateStr);
  const now = new Date();
  
  // Si la fecha es hoy o futura, devolver precio actual
  if (targetDate >= now) {
    return {
      estimatedPrice: currentPrice,
      explanation: 'Cotización actual del activo',
      formattedDate: 'Hoy',
    };
  }

  // Comprobar si hay anclas históricas conocidas
  const anchors = asset.historicalAnchors;
  if (anchors) {
    // Si hay coincidencia exacta de fecha
    if (anchors[dateStr] !== undefined) {
      return {
        estimatedPrice: anchors[dateStr],
        explanation: `Precio histórico registrado en ${formattedDate}`,
        formattedDate,
      };
    }

    // Buscar anclas anterior y posterior para interpolar
    const sortedDates = Object.keys(anchors).sort();
    
    // Si la fecha está antes de la primera ancla
    if (dateStr <= sortedDates[0]) {
      return {
        estimatedPrice: anchors[sortedDates[0]],
        explanation: `Precio histórico de referencia en ${formatDateToSpanish(sortedDates[0])}`,
        formattedDate,
      };
    }

    // Si la fecha está entre dos anclas
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const d1 = sortedDates[i];
      const d2 = sortedDates[i + 1];
      if (dateStr >= d1 && dateStr <= d2) {
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        const tTarget = targetDate.getTime();
        const ratio = (tTarget - t1) / (t2 - t1);
        const interpolated = anchors[d1] + ratio * (anchors[d2] - anchors[d1]);
        return {
          estimatedPrice: Number(interpolated.toFixed(2)),
          explanation: `Estimación interpolada para ${formattedDate}`,
          formattedDate,
        };
      }
    }

    // Si la fecha está entre la última ancla y hoy
    const lastAnchorDate = sortedDates[sortedDates.length - 1];
    const tLast = new Date(lastAnchorDate).getTime();
    const tNow = now.getTime();
    const tTarget = targetDate.getTime();
    const ratio = Math.max(0, Math.min(1, (tTarget - tLast) / (tNow - tLast)));
    const interpolated = anchors[lastAnchorDate] + ratio * (currentPrice - anchors[lastAnchorDate]);
    return {
      estimatedPrice: Number(interpolated.toFixed(2)),
      explanation: `Estimación de mercado para ${formattedDate}`,
      formattedDate,
    };
  }

  // Modelo estadístico general de descuento temporal según el tipo de activo
  // Acciones: ~10% anual, ETFs: ~8% anual, Fondos: ~7% anual, Cripto: ~35% anual
  const diffDays = Math.max(1, (now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365.25;

  let annualCagr = 0.09;
  if (asset.type === 'Acciones') annualCagr = 0.10;
  if (asset.type === 'ETFs') annualCagr = 0.08;
  if (asset.type === 'Fondos') annualCagr = 0.07;
  if (asset.type === 'Cripto') annualCagr = 0.35;

  // Precio hacia atrás = actual / (1 + cagr)^years
  const discounted = currentPrice / Math.pow(1 + annualCagr, diffYears);
  const estimatedPrice = Number(Math.max(0.01, discounted).toFixed(2));

  return {
    estimatedPrice,
    explanation: `Precio histórico estimado según rendimiento medio anual de ${asset.type}`,
    formattedDate,
  };
}
