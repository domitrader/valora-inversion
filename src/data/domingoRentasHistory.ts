// Historial fiscal agregado (Modelo 100, ejercicios 2021–2025) y parámetros de Renta 2026.
// NOTA DE PRIVACIDAD: Solo contiene cifras fiscales agregadas (sin NIF, IBAN, dirección ni códigos de verificación).

export interface RentaYearRecord {
  year: number;
  trabajoBrutoEur: number;
  trabajoNetoReducidoEur: number;
  art20Applied: boolean;
  capitalMobiliarioEur: number;
  degiroNetoEur: number;
  perdidasAplicadasPreviasEur: number;
  baseImponibleAhorroEur: number;
  minimoPersonalAhorroEur: number;
  retencionesEur: number;
  resultadoDeclaracionEur: number; // positivo = a ingresar, negativo = a devolver
  perdidasPendientesFuturoEur: number;
  nota?: string;
}

export const DOMINGO_RENTAS_HISTORY: RentaYearRecord[] = [
  {
    year: 2021,
    trabajoBrutoEur: 5423.03,
    trabajoNetoReducidoEur: 0,
    art20Applied: true,
    capitalMobiliarioEur: 116.7,
    degiroNetoEur: -4338.86,
    perdidasAplicadasPreviasEur: 0,
    baseImponibleAhorroEur: 87.52,
    minimoPersonalAhorroEur: 87.52,
    retencionesEur: 0,
    resultadoDeclaracionEur: 0,
    perdidasPendientesFuturoEur: 4309.68,
    nota: 'Pérdida patrimonial 2021 compensa 25% de dividendos y arrastra 4.309,68 € a ejercicios futuros.',
  },
  {
    year: 2022,
    trabajoBrutoEur: 5558.52,
    trabajoNetoReducidoEur: 0,
    art20Applied: true,
    capitalMobiliarioEur: 17.3,
    degiroNetoEur: -8747.62,
    perdidasAplicadasPreviasEur: 0,
    baseImponibleAhorroEur: 12.97,
    minimoPersonalAhorroEur: 12.97,
    retencionesEur: 0,
    resultadoDeclaracionEur: 0,
    perdidasPendientesFuturoEur: 13052.97,
    nota: 'Arrastre acumulado: 4.309,68 € (2021) + 8.743,29 € (2022).',
  },
  {
    year: 2023,
    trabajoBrutoEur: 5760.0,
    trabajoNetoReducidoEur: 0,
    art20Applied: true,
    capitalMobiliarioEur: 101.02,
    degiroNetoEur: 3642.61,
    perdidasAplicadasPreviasEur: 3667.87,
    baseImponibleAhorroEur: 75.76,
    minimoPersonalAhorroEur: 75.76,
    retencionesEur: 0,
    resultadoDeclaracionEur: 0,
    perdidasPendientesFuturoEur: 9385.1,
    nota: 'Ahorro < 6.500 € -> Art. 20 deja trabajo en 0 €. Resto pendiente: 641,81 € (2021) + 8.743,29 € (2022).',
  },
  {
    year: 2024,
    trabajoBrutoEur: 5760.0,
    trabajoNetoReducidoEur: 3760.0,
    art20Applied: false,
    capitalMobiliarioEur: 546.16,
    degiroNetoEur: 18838.21,
    perdidasAplicadasPreviasEur: 9385.1,
    baseImponibleAhorroEur: 9999.27,
    minimoPersonalAhorroEur: 1790.0,
    retencionesEur: 103.77,
    resultadoDeclaracionEur: 1535.97,
    perdidasPendientesFuturoEur: 0,
    nota: 'Se agotan al 100% los arrastres de 2021 y 2022. Al superar 6.500 € en ahorro no aplica Art. 20 (mínimo sobrante: 1.790 €).',
  },
  {
    year: 2025,
    trabajoBrutoEur: 5760.0,
    trabajoNetoReducidoEur: 3760.0,
    art20Applied: false,
    capitalMobiliarioEur: 694.52,
    degiroNetoEur: 9829.92,
    perdidasAplicadasPreviasEur: 0,
    baseImponibleAhorroEur: 10524.44,
    minimoPersonalAhorroEur: 1790.0,
    retencionesEur: 131.57,
    resultadoDeclaracionEur: 1618.47,
    perdidasPendientesFuturoEur: 0,
    nota: 'Sin arrastres pendientes para 2026. Aviso para gestor: en 2025 se declaró DEGIRO en casilla 1802 (monedas virtuales); en 2026 ponerlo en acciones/ETFs negociados (0326–0338).',
  },
];

export interface DomingoFiscalProfile2026 {
  subsidioBrutoAnualEur: number;
  gastosDeduciblesTrabajoEur: number;
  minimoContribuyenteEur: number;
  art20UmbralAhorroEur: number;
  art20ReduccionMaxEur: number;
  myInvestorInteresesBrutos2026Eur: number;
  myInvestorRetenciones2026Eur: number;
  otrasGanancias2026Eur: number;
  perdidasPendientesPreviasEur: number;
  myInvestorBreakdown: {
    cuentaPromoYAmigoBrutoEur: number;
    cuentaPeriodosBrutoEur: number;
    depositosVencidos12BrutoEur: number;
    deposito16DicBrutoEur: number;
    estimacionNovDicBrutoEur: number;
  };
}

export const DOMINGO_FISCAL_PROFILE_2026: DomingoFiscalProfile2026 = {
  subsidioBrutoAnualEur: 5760.0, // 480 €/mes × 12 (subsidio mayores de 52 años)
  gastosDeduciblesTrabajoEur: 2000.0,
  minimoContribuyenteEur: 5550.0,
  art20UmbralAhorroEur: 6500.0,
  art20ReduccionMaxEur: 7302.0,
  myInvestorInteresesBrutos2026Eur: 1493.16,
  myInvestorRetenciones2026Eur: 283.7,
  otrasGanancias2026Eur: 0.0,
  perdidasPendientesPreviasEur: 0.0,
  myInvestorBreakdown: {
    cuentaPromoYAmigoBrutoEur: 257.56,
    cuentaPeriodosBrutoEur: 146.99,
    depositosVencidos12BrutoEur: 838.47,
    deposito16DicBrutoEur: 200.14, // 162,11 € netos / 0,81
    estimacionNovDicBrutoEur: 50.0,
  },
};

export interface PersonalIrpfCalculation {
  totalAhorroEur: number;
  baseGeneralEur: number;
  art20Applied: boolean;
  minimoPersonalAhorroEur: number;
  cuotaIntegraEur: number;
  retencionesEur: number;
  resultadoFinalEur: number; // negativo = a devolver por Hacienda
  margenHastaCeroIrpfEur: number; // cuánto falta hasta 5.550 €
  margenHastaUmbralArt20Eur: number; // cuánto falta hasta 6.500 €
}

export function calculatePersonalIrpf2026(params: {
  degiroComputableEur: number;
  trabajoBrutoEur: number;
  interesesBrutosEur: number;
  otrasGananciasEur: number;
}): PersonalIrpfCalculation {
  const { degiroComputableEur, trabajoBrutoEur, interesesBrutosEur, otrasGananciasEur } = params;
  const retencionesEur = Math.round(Math.max(0, interesesBrutosEur) * 0.19 * 100) / 100;
  const netoPatrimonial = degiroComputableEur + otrasGananciasEur;

  // Si el saldo patrimonial es negativo, compensa hasta el 25% de los rendimientos de capital mobiliario
  const totalAhorroEur =
    netoPatrimonial >= 0
      ? netoPatrimonial + Math.max(0, interesesBrutosEur)
      : Math.max(
          0,
          Math.max(0, interesesBrutosEur) -
            Math.min(Math.abs(netoPatrimonial), Math.max(0, interesesBrutosEur) * 0.25)
        );

  const trabajoNeto = Math.max(0, trabajoBrutoEur - 2000);
  const art20Applied = trabajoNeto <= 14852 && totalAhorroEur <= 6500;
  const baseGeneralEur = art20Applied ? Math.max(0, trabajoNeto - 7302) : trabajoNeto;
  const minimoPersonalAhorroEur = Math.max(0, 5550 - baseGeneralEur);

  const calcSavingsTax = (base: number): number => {
    if (base <= 0) return 0;
    let rem = base;
    let tax = 0;
    const brackets: Array<[number, number]> = [
      [6000, 0.19],
      [44000, 0.21],
      [150000, 0.23],
      [100000, 0.27],
      [Infinity, 0.3],
    ];
    for (const [cap, rate] of brackets) {
      const take = Math.min(rem, cap);
      tax += take * rate;
      rem -= take;
      if (rem <= 0) break;
    }
    return tax;
  };

  const cuotaBruta = calcSavingsTax(totalAhorroEur);
  const cuotaMinimo = calcSavingsTax(Math.min(totalAhorroEur, minimoPersonalAhorroEur));
  const cuotaIntegraEur = Math.round(Math.max(0, cuotaBruta - cuotaMinimo) * 100) / 100;
  const resultadoFinalEur = Math.round((cuotaIntegraEur - retencionesEur) * 100) / 100;

  return {
    totalAhorroEur: Math.round(totalAhorroEur * 100) / 100,
    baseGeneralEur: Math.round(baseGeneralEur * 100) / 100,
    art20Applied,
    minimoPersonalAhorroEur: Math.round(minimoPersonalAhorroEur * 100) / 100,
    cuotaIntegraEur,
    retencionesEur,
    resultadoFinalEur,
    margenHastaCeroIrpfEur: Math.round((minimoPersonalAhorroEur - totalAhorroEur) * 100) / 100,
    margenHastaUmbralArt20Eur: Math.round((6500 - totalAhorroEur) * 100) / 100,
  };
}
