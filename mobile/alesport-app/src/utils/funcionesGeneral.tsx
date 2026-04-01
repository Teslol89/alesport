function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Función para obtener los días de la semana actual (lunes a domingo)
export function getCurrentWeekDays() {
  const today = new Date();
  // Día de la semana (0=domingo, 1=lunes, ...)
  const dayOfWeek = today.getDay();
  // Calcular el lunes de la semana actual
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
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
  // Devuelve un array de objetos {date, num, label} para todos los días del mes
  const days: { date: string; num: number; label: string }[] = [];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month, d);
    days.push({
      date: toLocalISODate(dateObj),
      num: d,
      label: dayNames[(dateObj.getDay() + 6) % 7],
    });
  }
  return days;
}
