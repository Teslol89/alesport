import React, { useState, useEffect } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonModal, IonSpinner } from '@ionic/react';
import './Calendar.css';
import { getCurrentWeekDays, getMonthDays } from '../utils/funcionesGeneral';
import { getSessionsByDateRange } from '../api/sessions';

function formatFullDateES(dateStr: string) {
  const date = new Date(dateStr);
  const optionsDay: Intl.DateTimeFormatOptions = { weekday: 'long' };
  const optionsDate: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  // Español
  const day = date.toLocaleDateString('es-ES', optionsDay);
  const fullDate = date.toLocaleDateString('es-ES', optionsDate);
  // Capitalizar la primera letra
  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    fullDate: fullDate.charAt(0).toUpperCase() + fullDate.slice(1),
  };
}

const Calendar: React.FC = () => {
  const weekDays = getCurrentWeekDays();
  const todayDate = weekDays.find((d: any) => d.isToday)?.date || weekDays[0].date;
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para el modal mensual
  const today = new Date();
  const monthDays = getMonthDays(today.getFullYear(), today.getMonth());

  // Obtener rango de la semana actual
  const startDate = weekDays[0].date;
  const endDate = weekDays[6].date;

  // Cargar sesiones reales al montar o cambiar semana
  useEffect(() => {
    setLoading(true);
    setError(null);
    getSessionsByDateRange(startDate, endDate)
      .then(data => setSessions(data))
      .catch(() => setError("No se pudieron cargar las sesiones"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  // Filtra sesiones por fecha seleccionada
  const sessionsForDate = sessions.filter(s => s.session_date === selectedDate);

  const fechaES = formatFullDateES(selectedDate);

  return (
    <div className="calendar-container">
      {/* Cabecera con día y fecha seleccionada y botón Ver mes */}
      <div className="calendar-header-row">
        <div className="calendar-selected-date">
          <div className="calendar-selected-day">{fechaES.day}</div>
          <div className="calendar-selected-fulldate">{fechaES.fullDate}</div>
        </div>
        <button className="calendar-view-month-btn" onClick={() => setShowMonthModal(true)}>
          Ver mes
        </button>
      </div>
      {/* Selector de días deslizable */}
      <div className="calendar-days-scroll">
        {weekDays.map((day: any) => (
          <button
            key={day.date}
            className={`calendar-day-btn${selectedDate === day.date ? ' selected' : ''}`}
            onClick={() => setSelectedDate(day.date)}
          >
            <span className="calendar-day-label">{day.label}</span>
            <span className="calendar-day-num">{day.num}</span>
          </button>
        ))}
      </div>
      {/* Lista de sesiones o indicador de carga */}
      <div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : sessionsForDate.length === 0 ? (
          <p>No hay sesiones para este día.</p>
        ) : (
          sessionsForDate.map(session => (
            <IonCard key={session.id} color={session.status === 'active' ? 'success' : 'medium'}>
              <IonCardHeader>
                <IonCardTitle>
                  {session.start_time} - {session.end_time} | {session.trainer_id ? `Entrenador ${session.trainer_id}` : ''}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                Estado: {session.status} <br />
                Aforo: {session.capacity}
                <br />
                <button className="calendar-details-btn">Ver detalles</button>
              </IonCardContent>
            </IonCard>
          ))
        )}
      </div>
      {/* Modal de mes completo */}
      <IonModal isOpen={showMonthModal} onDidDismiss={() => setShowMonthModal(false)}>
        <div className="calendar-month-modal">
          <h3>Selecciona un día del mes</h3>
          <div className="calendar-month-grid">
            {monthDays.map((day: any) => (
              <button
                key={day.date}
                className={`calendar-month-day-btn${selectedDate === day.date ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedDate(day.date);
                  setShowMonthModal(false);
                }}
              >
                <span className="calendar-day-label">{day.label}</span>
                <span className="calendar-day-num">{day.num}</span>
              </button>
            ))}
          </div>
          <button className="calendar-close-modal-btn" onClick={() => setShowMonthModal(false)}>
            Cerrar
          </button>
        </div>
      </IonModal>
    </div>
  );
};

export default Calendar;
