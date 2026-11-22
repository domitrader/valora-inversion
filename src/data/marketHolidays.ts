export interface MarketHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  markets: Array<'BME' | 'NYSE' | 'NASDAQ' | 'XETRA' | 'MIL' | 'EPA'>;
  status: 'Cerrado' | 'Cierre temprano (14:00)' | 'Cierre temprano (19:00 CET)';
  description: string;
}

export const MARKET_HOLIDAYS_2026_2027: MarketHoliday[] = [
  // 2026
  {
    date: '2026-01-01',
    name: 'Año Nuevo',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre total en todas las plazas bursátiles internacionales por inicio de año.',
  },
  {
    date: '2026-01-19',
    name: 'Día de Martin Luther King Jr.',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Wall Street cerrado. Bolsas europeas (BME, XETRA, Milán) operan con normalidad.',
  },
  {
    date: '2026-02-16',
    name: "Presidents' Day (Día de los Presidentes)",
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Festivo federal en EE.UU. Bolsas europeas abiertas.',
  },
  {
    date: '2026-04-03',
    name: 'Viernes Santo (Good Friday)',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre total de mercados en Europa y Estados Unidos.',
  },
  {
    date: '2026-04-06',
    name: 'Lunes de Pascua (Easter Monday)',
    markets: ['BME', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre en Europa. Wall Street (NYSE/NASDAQ) opera con normalidad.',
  },
  {
    date: '2026-05-01',
    name: 'Día del Trabajo',
    markets: ['BME', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre en bolsas europeas. Wall Street abierto.',
  },
  {
    date: '2026-05-25',
    name: 'Memorial Day (Día de los Caídos)',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Cierre completo en Wall Street. Europa opera con normalidad.',
  },
  {
    date: '2026-06-19',
    name: 'Juneteenth National Independence Day',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Festivo federal estadounidense. Europa abierta.',
  },
  {
    date: '2026-07-03',
    name: 'Día de la Independencia (Observado)',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Cierre en EE.UU. por festivo del 4 de Julio.',
  },
  {
    date: '2026-09-07',
    name: 'Labor Day (EE.UU.)',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Cierre festivo en mercados estadounidenses.',
  },
  {
    date: '2026-11-26',
    name: 'Thanksgiving Day (Acción de Gracias)',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Wall Street cerrado por Acción de Gracias. Europa abierta.',
  },
  {
    date: '2026-11-27',
    name: 'Black Friday (Sesión corta en EE.UU.)',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cierre temprano (19:00 CET)',
    description: 'Wall Street cierra a las 13:00 EST (19:00 hora de Madrid). Europa horario habitual.',
  },
  {
    date: '2026-12-24',
    name: 'Nochebuena',
    markets: ['BME', 'XETRA', 'MIL'],
    status: 'Cierre temprano (14:00)',
    description: 'BME y plazas europeas cierran a las 14:00 CET o no operan en contado.',
  },
  {
    date: '2026-12-25',
    name: 'Navidad',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre internacional completo por festividad de Navidad.',
  },
  {
    date: '2026-12-26',
    name: 'San Esteban / Boxing Day',
    markets: ['BME', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre festivo en bolsas europeas.',
  },
  {
    date: '2026-12-31',
    name: 'Fin de Año',
    markets: ['BME', 'XETRA', 'MIL'],
    status: 'Cierre temprano (14:00)',
    description: 'Última sesión del año con horario reducido en plazas europeas.',
  },

  // 2027
  {
    date: '2027-01-01',
    name: 'Año Nuevo 2027',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre festivo mundial de Año Nuevo.',
  },
  {
    date: '2027-01-18',
    name: 'Martin Luther King Jr. Day 2027',
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Wall Street cerrado. Europa abierta.',
  },
  {
    date: '2027-02-15',
    name: "Presidents' Day 2027",
    markets: ['NYSE', 'NASDAQ'],
    status: 'Cerrado',
    description: 'Cierre en EE.UU. por Día de los Presidentes.',
  },
  {
    date: '2027-03-26',
    name: 'Viernes Santo 2027',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre internacional por Viernes Santo.',
  },
  {
    date: '2027-03-29',
    name: 'Lunes de Pascua 2027',
    markets: ['BME', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre en Europa. Wall Street abierto.',
  },
  {
    date: '2027-05-01',
    name: 'Día del Trabajo 2027',
    markets: ['BME', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre festivo en plazas europeas.',
  },
  {
    date: '2027-12-25',
    name: 'Navidad 2027',
    markets: ['BME', 'NYSE', 'NASDAQ', 'XETRA', 'MIL', 'EPA'],
    status: 'Cerrado',
    description: 'Cierre festivo mundial de Navidad.',
  },
];

export interface MarketStatusInfo {
  isOpenToday: boolean;
  isWeekend: boolean;
  holidayToday: MarketHoliday | null;
  nextHoliday: MarketHoliday | null;
  daysUntilNextHoliday: number;
  marketNotice: string;
}

export function getMarketStatusInfo(currentDateStr?: string): MarketStatusInfo {
  const now = currentDateStr ? new Date(currentDateStr) : new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado
  const isoDate = now.toISOString().split('T')[0];

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const holidayToday = MARKET_HOLIDAYS_2026_2027.find(h => h.date === isoDate) || null;

  // Próximo festivo a partir de hoy
  const upcomingHolidays = MARKET_HOLIDAYS_2026_2027
    .filter(h => h.date >= isoDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;
  let daysUntil = 0;
  if (nextHoliday) {
    const targetDate = new Date(nextHoliday.date + 'T00:00:00');
    const todayDate = new Date(isoDate + 'T00:00:00');
    daysUntil = Math.ceil((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  let marketNotice = '';
  let isOpenToday = true;

  if (isWeekend) {
    isOpenToday = false;
    marketNotice = 'Fin de semana: Mercados de renta variable y ETFs cerrados. Criptoactivos cotizan 24/7.';
  } else if (holidayToday) {
    isOpenToday = holidayToday.status !== 'Cerrado';
    marketNotice = `Festivo bursátil: ${holidayToday.name} (${holidayToday.markets.join(', ')}). ${holidayToday.description}`;
  } else {
    marketNotice = 'Mercados bursátiles operativos en horario habitual: Europa 09:00 - 17:30 CET | Wall Street 15:30 - 22:00 CET.';
  }

  return {
    isOpenToday,
    isWeekend,
    holidayToday,
    nextHoliday,
    daysUntilNextHoliday: daysUntil,
    marketNotice,
  };
}
