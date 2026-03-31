import React, { useState, useEffect } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonModal, IonSpinner } from '@ionic/react';
import './Calendar.css';
import horaIcon from '../icons/horaColor.webp';
import aforoIcon from '../icons/aforo.webp';
import infoIcon from '../icons/detallesColor.svg';
import { getCurrentWeekDays, getMonthDays } from '../utils/funcionesGeneral';
import { getSessionsByDateRange, patchSessionHour } from '../api/sessions';
import { getUserProfile } from '../api/user';

function formatFullDateES(dateStr: string) {
  const date = new Date(dateStr);
  const optionsDay: Intl.DateTimeFormatOptions = { weekday: 'long' };
  // Formato personalizado: "Marzo 31, 2026"
  const day = date.toLocaleDateString('es-ES', optionsDay);
  const month = date.toLocaleDateString('es-ES', { month: 'long' });
  const dayNum = date.getDate();
  const year = date.getFullYear();
  // Capitalizar mes
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  const fullDate = `${monthCap} ${dayNum}, ${year}`;
  return {
    day: day.charAt(0).toUpperCase() + day.slice(1),
    fullDate,
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
  // Estado para controlar el modal y la sesión seleccionada
  const [showHourModal, setShowHourModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

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

  // Función para abrir el modal de edición de hora
  function handleEditHour(session: any) {
    setEditingSession(session);
    setNewStartTime(session.start_time?.slice(0,5) || '');
    setNewEndTime(session.end_time?.slice(0,5) || '');
    setShowHourModal(true);
  }

  // Función para guardar la nueva hora (aquí solo actualiza el estado local, deberías llamar a la API real)
  async function handleSaveHour() {
    if (editingSession) {
      try {
        await patchSessionHour(editingSession.id, newStartTime, newEndTime);
        setSessions(prev => prev.map(s => s.id === editingSession.id ? {
          ...s,
          start_time: newStartTime + ':00',
          end_time: newEndTime + ':00',
        } : s));
      } catch (err) {
        alert('Error al guardar la hora en el servidor');
      }
    }
    setShowHourModal(false);
    setEditingSession(null);
  }

  // Obtener perfil del usuario
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    getUserProfile(() => {}).then(profile => {
      setUserRole(profile.role || null);
    }).catch(() => setUserRole(null));
  }, []);

  return (
    <div className="calendar-container">
      {/* Top bar fija con fecha y botón */}
      <div className="calendar-top-bar">
        <div className="calendar-selected-date">
          <div className="calendar-selected-day">{fechaES.day}</div>
          <div className="calendar-selected-fulldate">{fechaES.fullDate}</div>
        </div>
        <button className="calendar-view-month-btn" onClick={() => setShowMonthModal(true)}>
          Ver mes
        </button>
      </div>
      {/* Scroll de días debajo */}
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
      {/* Bloque independiente para las sesiones */}
      <div className="calendar-sessions-section">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : sessionsForDate.length === 0 ? (
          <p>No hay sesiones para este día.</p>
        ) : (
          sessionsForDate.map(session => {
            const cardClass = `session-card ion-color-${session.status === 'active' ? 'success' : 'danger'}`;
            // Formatear hora a HH:mm de forma robusta
            function formatHour(dateInput: string | Date, sessionDate?: string): string {
              let d: Date;
              if (typeof dateInput === 'string') {
                // Si es solo hora, combínala con la fecha
                if (/^\d{2}:\d{2}:\d{2}$/.test(dateInput) && sessionDate) {
                  d = new Date(`${sessionDate}T${dateInput}`);
                } else {
                  let safeStr = dateInput;
                  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(dateInput)) {
                    safeStr = dateInput.replace(' ', 'T');
                  }
                  d = new Date(safeStr);
                }
              } else {
                d = dateInput;
              }
              if (isNaN(d.getTime())) return '-';
              const hours = d.getHours().toString().padStart(2, '0');
              const minutes = d.getMinutes().toString().padStart(2, '0');
              return `${hours}:${minutes}`;
            }
            return (
              <IonCard key={session.id} className={cardClass}>
                <IonCardHeader>
                  <IonCardTitle>
                    <div className="session-title-row-flex">
                      <span className="session-title-custom session-title-row">
                        {userRole === 'admin' ? (
                          <button type="button" className="session-title-icon-btn" onClick={() => handleEditHour(session)} title="Editar hora">
                            <img src={horaIcon} alt="Hora" className="session-title-icon" />
                          </button>
                        ) : (
                          <img src={horaIcon} alt="Hora" className="session-title-icon" />
                        )}
                        {formatHour(session.start_time, session.session_date)} - {formatHour(session.end_time, session.session_date)}
                      </span>
                      {session.trainer_name ? (
                        <span className="session-title-trainer">{session.trainer_name}</span>
                      ) : null}
                    </div>
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <span className='session-small-title-custom session-aforo-row'>
                    <img src={aforoIcon} alt="Aforo" className="session-aforo-icon" />
                    {session.capacity}
                    <div className='calendar-details-btn-container'>
                      <button className="calendar-details-btn" title="Detalles">
                        <img src={infoIcon} alt="Detalles" className="calendar-details-btn-icon" />
                      </button>
                    </div>
                  </span>
                </IonCardContent>
              </IonCard>
            );
          })
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
      {/* Modal de edición de hora */}
      <IonModal isOpen={showHourModal} onDidDismiss={() => setShowHourModal(false)}>
        <div className="calendar-hour-modal">
          <h3>Editar hora de la sesión</h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
            <label>
              Inicio:
              <input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} />
            </label>
            <label>
              Fin:
              <input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={handleSaveHour} className="calendar-hour-modal-save">Guardar</button>
            <button onClick={() => setShowHourModal(false)} className="calendar-hour-modal-cancel">Cancelar</button>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default Calendar;
