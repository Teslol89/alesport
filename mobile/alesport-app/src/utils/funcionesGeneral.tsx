/**
 * Devuelve el lunes de la semana de una fecha dada (en formato ISO yyyy-mm-dd)
 */
export function getMondayOfWeek(dateIso: string): string {
  const date = new Date(dateIso);
  const day = date.getDay();
  // Si es domingo (0), retrocede 6 días; si es lunes (1), retrocede 0; si es martes (2), retrocede 1...
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * Devuelve el domingo de la semana de una fecha dada (en formato ISO yyyy-mm-dd)
 */
export function getSundayOfWeek(mondayIso: string): string {
  const date = new Date(mondayIso);
  date.setDate(date.getDate() + 6);
  return date.toISOString().slice(0, 10);
}
/* Para obtener la fecha en formato ISO local (YYYY-MM-DD) */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* Devuelve la fecha actual en formato ISO local (YYYY-MM-DD) */
export function getTodayIsoDate(): string {
  return toLocalISODate(new Date());
}

/* Devuelve una fecha ISO en formato legible para UI (DD / MM / YYYY o similar) */
export function formatIsoDateForUi(isoDate: string, separator = ' / '): string {
  if (!isoDate || isoDate.length < 10) {
    return `--${separator}--${separator}----`;
  }

  const [yyyy, mm, dd] = isoDate.slice(0, 10).split('-');
  return `${dd}${separator}${mm}${separator}${yyyy}`;
}

/* Devuelve la fecha de ayer en formato ISO local (YYYY-MM-DD) */
export function formatDateDdMmYy(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year.slice(-2)}`;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/* Devuelve la hora en formato HH:MM a partir de un string ISO o un objeto Date */
export function formatHour(dateInput: string | Date, sessionDate?: string, fallback = '-'): string {
  let date: Date;

  if (typeof dateInput === 'string') {
    if (/^\d{2}:\d{2}:\d{2}$/.test(dateInput) && sessionDate) {
      date = new Date(`${sessionDate}T${dateInput}`);
    } else {
      const safeDateStr = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(dateInput)
        ? dateInput.replace(' ', 'T')
        : dateInput;
      date = new Date(safeDateStr);
    }
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) {
    return fallback;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/* Función para formatear fecha completa en español (ej: "Lunes, 5 de Junio de 2024") */
export function formatFullDateES(dateStr: string): { day: string; fullDate: string } {
  const date = new Date(dateStr);
  const day = date.toLocaleDateString('es-ES', { weekday: 'long' });
  const month = date.toLocaleDateString('es-ES', { month: 'long' });
  const fullDate = `${capitalizeFirst(month)} ${date.getDate()}, ${date.getFullYear()}`;

  return {
    day: capitalizeFirst(day),
    fullDate,
  };
}

/* Función para formatear fecha en formato "5 Jun" */
export function getMonthLabelES(date: Date): string {
  return capitalizeFirst(date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
}

export function mapBookingStatus(status: string): string {
  return status === 'active' ? 'Activa' : 'Cancelada';
}

export function isSameDay(baseDate: Date, targetDate: Date): boolean {
  return baseDate.getFullYear() === targetDate.getFullYear()
    && baseDate.getMonth() === targetDate.getMonth()
    && baseDate.getDate() === targetDate.getDate();
}

export function isSameWeek(baseDate: Date, targetDate: Date): boolean {
  const base = new Date(baseDate);
  const target = new Date(targetDate);
  base.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const mondayOffset = (base.getDay() + 6) % 7;
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return target >= weekStart && target <= weekEnd;
}

export function toPickerTimeIso(hourValue: string, baseDate = '1970-01-01'): string {
  return `${baseDate}T${hourValue}:00`;
}

export function fromPickerTimeIso(isoValue: string): string {
  const match = isoValue.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Función para obtener los días de la semana (lunes a domingo) basada en una fecha
export function getCurrentWeekDays(baseDate?: string | Date) {
  const today = new Date();
  const referenceDate =
    typeof baseDate === 'string'
      ? new Date(`${baseDate}T00:00:00`)
      : baseDate instanceof Date
        ? new Date(baseDate)
        : new Date(today);

  if (isNaN(referenceDate.getTime())) {
    return getCurrentWeekDays();
  }

  // Día de la semana (0=domingo, 1=lunes, ...)
  const dayOfWeek = referenceDate.getDay();
  // Calcular el lunes de la semana actual
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((dayOfWeek + 6) % 7));
  // Generar los 7 días de la semana
  const days = [];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      label: dayNames[i],
      date: toLocalISODate(d),
      num: d.getDate(),
      isToday:
        toLocalISODate(d) === toLocalISODate(today),
    });
  }
  return days;
}

// Función para obtener los días del mes
export function getMonthDays(year: number, month: number) {
  // Devuelve una grilla fija de 6 semanas (42 celdas) para un calendario mensual real.
  const todayIso = toLocalISODate(new Date());
  const days: {
    date: string;
    num: number;
    label: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
  }[] = [];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);

  for (let d = 0; d < 42; d++) {
    const dateObj = new Date(gridStart);
    dateObj.setDate(gridStart.getDate() + d);
    const isoDate = toLocalISODate(dateObj);

    days.push({
      date: isoDate,
      num: dateObj.getDate(),
      label: dayNames[(dateObj.getDay() + 6) % 7],
      isCurrentMonth: dateObj.getMonth() === month,
      isToday: isoDate === todayIso,
      isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
    });
  }

  return days;
}
