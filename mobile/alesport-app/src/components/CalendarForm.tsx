import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonModal, IonSpinner, IonDatetime } from '@ionic/react';
import './CalendarForm.css';
import CustomToast from './CustomStyles';
import horaIcon from '../icons/horaColor.webp';
import aforoIcon from '../icons/editarAlumnos.webp';
import infoIcon from '../icons/detallesColor.svg';
import {
  formatDateDdMmYy,
  formatFullDateES,
  formatHour,
  fromPickerTimeIso,
  getCurrentWeekDays,
  getTodayIsoDate,
  toPickerTimeIso,
} from '../utils/funcionesGeneral';
import { getSessionsByDateRange, patchSessionHour } from '../api/sessions';
import { getUserProfile } from '../api/user';
import { BookingItem, cancelBooking, getBookingsBySession, reactivateBooking } from '../api/bookings';

const Calendar: React.FC = () => {
  const TIME_PICKER_BASE_DATE = '1970-01-01';

  type SessionItem = {
    id: number;
    trainer_id: number;
    trainer_name?: string;
    session_date: string;
    start_time: string | Date;
    end_time: string | Date;
    capacity: number;
    status: string;
  };

  const initialWeekDays = getCurrentWeekDays();
  const todayDate = initialWeekDays.find((d: any) => d.isToday)?.date || initialWeekDays[0].date;
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayDate);
  const weekDays = useMemo(() => getCurrentWeekDays(weekAnchorDate), [weekAnchorDate]);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado modal edición de hora
  const [showHourModal, setShowHourModal] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionItem | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
  const [timePickerValue, setTimePickerValue] = useState(`${TIME_PICKER_BASE_DATE}T08:00:00`);

  // Estado modal detalles/alumnos
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSession, setDetailsSession] = useState<SessionItem | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [sessionOccupancy, setSessionOccupancy] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' | 'info' }>({
    show: false,
    message: '',
    type: 'danger',
  });

  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Sincronizar selectedDate cuando se abre el modal de mes
  useEffect(() => {
    if (showMonthModal) {
      setSelectedDate(weekAnchorDate);
    }
  }, [showMonthModal, weekAnchorDate]);

  // Obtener rango de la semana actual
  const startDate = weekDays[0].date;
  const endDate = weekDays[6].date;

  // Cargar sesiones reales al montar o cambiar semana
  useEffect(() => {
    setLoading(true);
    setError(null);
    getSessionsByDateRange(startDate, endDate)
      .then(data => setSessions(data as SessionItem[]))
      .catch(() => setError("No se pudieron cargar las sesiones"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  // Filtra y ordena sesiones por fecha seleccionada y hora de inicio
  const sessionsForDate = useMemo(
    () =>
      sessions
        .filter(s => s.session_date === selectedDate)
        .sort((a, b) => {
          const startA = formatHour(a.start_time, a.session_date, '00:00');
          const startB = formatHour(b.start_time, b.session_date, '00:00');
          return startA.localeCompare(startB);
        }),
    [sessions, selectedDate],
  );

  const fechaES = formatFullDateES(selectedDate);

  // Función para abrir el modal de edición de hora
  function handleEditHour(session: SessionItem) {
    if (isPastSession(session)) {
      setToast({ show: true, message: 'No se pueden modificar sesiones de días pasados', type: 'danger' });
      return;
    }

    const start = formatHour(session.start_time, session.session_date);
    const end = formatHour(session.end_time, session.session_date);
    setEditingSession(session);
    setNewStartTime(start !== '-' ? start : '');
    setNewEndTime(end !== '-' ? end : '');
    setShowHourModal(true);
  }

  async function openDetailsModal(session: SessionItem) {
    setDetailsSession(session);
    setShowDetailsModal(true);
    setBookingsLoading(true);
    try {
      const data = await getBookingsBySession(session.id);
      setBookings(data);
    } catch {
      setBookings([]);
      setToast({ show: true, message: 'No se pudieron cargar los alumnos de la sesión', type: 'danger' });
    } finally {
      setBookingsLoading(false);
    }
  }

  async function handleCancelBooking(bookingId: number) {
    if (detailsSession && isPastSession(detailsSession)) {
      setToast({ show: true, message: 'No se pueden modificar reservas de días pasados', type: 'danger' });
      return;
    }

    if (!window.confirm('¿Seguro que quieres cancelar esta reserva?')) {
      return;
    }
    try {
      await cancelBooking(bookingId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
      setToast({ show: true, message: 'Reserva cancelada correctamente', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cancelar la reserva';
      setToast({ show: true, message, type: 'danger' });
    }
  }

  async function handleReactivateBooking(bookingId: number) {
    if (detailsSession && isPastSession(detailsSession)) {
      setToast({ show: true, message: 'No se pueden modificar reservas de días pasados', type: 'danger' });
      return;
    }

    if (!window.confirm('¿Seguro que quieres reactivar esta reserva?')) {
      return;
    }
    try {
      await reactivateBooking(bookingId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, status: 'active' } : b)));
      setToast({ show: true, message: 'Reserva reactivada correctamente', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo reactivar la reserva';
      setToast({ show: true, message, type: 'danger' });
    }
  }

  function toPickerIso(hourValue: string) {
    return toPickerTimeIso(hourValue, TIME_PICKER_BASE_DATE);
  }

  function fromPickerIsoToHm(isoValue: string) {
    return fromPickerTimeIso(isoValue);
  }

  function openTimePicker(target: 'start' | 'end') {
    const currentValue = target === 'start' ? newStartTime : newEndTime;
    const normalizedValue = currentValue ? `${currentValue.slice(0, 2)}:00` : '';
    setTimePickerTarget(target);
    setTimePickerValue(normalizedValue ? toPickerIso(normalizedValue) : `${TIME_PICKER_BASE_DATE}T08:00:00`);
    setShowTimePickerModal(true);
  }

  function applyPickedTime() {
    const hourValue = fromPickerIsoToHm(timePickerValue);
    if (!hourValue || !timePickerTarget) {
      setShowTimePickerModal(false);
      return;
    }
    if (timePickerTarget === 'start') {
      setNewStartTime(hourValue);
    } else {
      setNewEndTime(hourValue);
    }
    setShowTimePickerModal(false);
  }

  // Función para guardar la nueva hora (aquí solo actualiza el estado local, deberías llamar a la API real)
  async function handleSaveHour() {
    if (!editingSession) {
      return;
    }

    if (isPastSession(editingSession)) {
      setToast({ show: true, message: 'No se pueden modificar sesiones de días pasados', type: 'danger' });
      setShowHourModal(false);
      setEditingSession(null);
      return;
    }

    try {
      await patchSessionHour(editingSession.id, newStartTime, newEndTime);
      setSessions(prev => prev.map(s => s.id === editingSession.id ? {
        ...s,
        start_time: newStartTime + ':00',
        end_time: newEndTime + ':00',
      } : s));
      setToast({ show: true, message: 'Hora actualizada correctamente', type: 'success' });
      setShowHourModal(false);
      setEditingSession(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al guardar la hora en el servidor';
      setToast({ show: true, message, type: 'danger' });
    }
  }

  // Obtener perfil del usuario
  const [userRole, setUserRole] = useState<string | null>(null);
  useEffect(() => {
    getUserProfile(() => { }).then(profile => {
      setUserRole(profile.role || null);
    }).catch(() => setUserRole(null));
  }, []);

  useEffect(() => {
    const selectedButton = dayButtonRefs.current[selectedDate];
    if (selectedButton) {
      selectedButton.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedDate]);

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'trainer') {
      return;
    }

    let cancelled = false;

    const loadOccupancy = async () => {
      const occupancyEntries = await Promise.all(
        sessionsForDate.map(async (session) => {
          try {
            const sessionBookings = await getBookingsBySession(session.id);
            const activeCount = sessionBookings.filter(b => b.status === 'active').length;
            return [session.id, activeCount] as const;
          } catch {
            return [session.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setSessionOccupancy(prev => ({
          ...prev,
          ...Object.fromEntries(occupancyEntries),
        }));
      }
    };

    if (sessionsForDate.length > 0) {
      loadOccupancy();
    }

    return () => {
      cancelled = true;
    };
  }, [sessionsForDate, userRole]);

  useEffect(() => {
    if (!detailsSession) {
      return;
    }

    const activeCount = bookings.filter(b => b.status === 'active').length;
    setSessionOccupancy(prev => ({ ...prev, [detailsSession.id]: activeCount }));
  }, [bookings, detailsSession]);

  const activeBookingsCount = bookings.filter(b => b.status === 'active').length;
  const isPastSession = (session: SessionItem) => session.session_date < getTodayIsoDate();
  const isDetailsSessionPast = detailsSession ? isPastSession(detailsSession) : false;

  return (
    <div className="calendar-container">
      {/* Top bar fija con fecha y botón */}
      <div className="calendar-top-bar">
        <div className="calendar-selected-date">
          <div className="calendar-selected-day">{fechaES.day}</div>
          <div className="calendar-selected-fulldate">{fechaES.fullDate}</div>
        </div >
        <button
          className="calendar-view-month-btn"
          onClick={(e) => {
            setShowMonthModal(true);
            e.currentTarget.blur();
          }}
        >
          Ver mes
        </button>
      </div>
      {/* Scroll de días debajo */}
      <div className="calendar-days-scroll">
        {weekDays.map((day: any) => (
          <button
            key={day.date}
            ref={(el) => { dayButtonRefs.current[day.date] = el; }}
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
            const occupancy = sessionOccupancy[session.id] ?? 0;
            const isAtCapacity = occupancy >= session.capacity;
            const isPast = isPastSession(session);
            const colorClass = isAtCapacity ? 'danger' : 'success';
            const cardClass = `session-card ion-color-${colorClass}`;
            return (
              <IonCard key={session.id} className={cardClass}>
                <IonCardHeader>
                  <IonCardTitle>
                    <div className="session-title-row-flex">
                      <span className="session-title-custom session-title-row">
                        {userRole === 'admin' && !isPast ? (
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
                    {`${occupancy}/${session.capacity}`}
                    <div className='calendar-details-btn-container'>
                      <button className="calendar-details-btn" title="Detalles" onClick={() => openDetailsModal(session)}>
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
      <IonModal className="calendar-month-modal-wrapper" isOpen={showMonthModal} onDidDismiss={() => setShowMonthModal(false)}>
        <div className="calendar-month-modal">
          <h4>Seleccionar fecha</h4>
          <IonDatetime
            className="calendar-month-date-calendar"
            presentation="date"
            firstDayOfWeek={1}
            locale="es-ES"
            value={selectedDate}
            onIonChange={(e) => {
              const next = e.detail.value;
              if (typeof next === 'string') {
                const nextDate = next.slice(0, 10);
                setSelectedDate(nextDate);
                setWeekAnchorDate(nextDate);
              }
            }}
          />
          <button
            className="calendar-close-modal-btn"
            onClick={(e) => {
              setShowMonthModal(false);
              e.currentTarget.blur();
            }}
          >
            Cerrar
          </button>
        </div>
      </IonModal>

      {/* Modal de edición de hora */}
      <IonModal className="calendar-hour-modal-wrapper" isOpen={showHourModal} onDidDismiss={() => setShowHourModal(false)}>
        <div className="calendar-hour-modal">
          <h3>Editar hora de la sesión</h3>
          <p className="calendar-hour-modal-subtitle">Selecciona la nueva franja horaria</p>
          <div className="calendar-hour-modal-fields">
            <label className="calendar-hour-modal-label">
              <span>Inicio</span>
              <button type="button" className="calendar-hour-picker-field" onClick={() => openTimePicker('start')}>
                {newStartTime || '--:--'}
              </button>
            </label>
            <label className="calendar-hour-modal-label">
              <span>Fin</span>
              <button type="button" className="calendar-hour-picker-field" onClick={() => openTimePicker('end')}>
                {newEndTime || '--:--'}
              </button>
            </label>
          </div>
          <div className="calendar-hour-modal-actions">
            <button onClick={handleSaveHour} className="calendar-hour-modal-save">Guardar</button>
            <button onClick={() => setShowHourModal(false)} className="calendar-hour-modal-cancel">Cancelar</button>
          </div>
        </div>
      </IonModal>

      {/* Modal del time picker reutilizable para inicio y fin */}
      <IonModal className="calendar-time-picker-modal-wrapper" isOpen={showTimePickerModal} onDidDismiss={() => setShowTimePickerModal(false)}>
        <div className="calendar-time-picker-modal">
          <h4>{timePickerTarget === 'start' ? 'Hora de inicio' : 'Hora de fin'}</h4>
          <IonDatetime
            className="calendar-time-picker"
            presentation="time"
            preferWheel={true}
            minuteValues="0,30"
            value={timePickerValue}
            onIonChange={(e) => {
              const nextValue = e.detail.value;
              if (typeof nextValue === 'string') {
                setTimePickerValue(nextValue);
              }
            }}
          />
          <div className="calendar-hour-modal-actions">
            <button onClick={applyPickedTime} className="calendar-hour-modal-save">Aplicar</button>
            <button onClick={() => setShowTimePickerModal(false)} className="calendar-hour-modal-cancel">Cancelar</button>
          </div>
        </div>
      </IonModal>

      {/* Modal de detalles de sesión y alumnos */}
      <IonModal className="calendar-bookings-modal-wrapper" isOpen={showDetailsModal} onDidDismiss={() => setShowDetailsModal(false)}>
        <div className="calendar-bookings-modal">
          <h3>Detalles de la clase</h3>
          {detailsSession ? (
            <>
              <p className="calendar-bookings-modal-subtitle">
                {formatDateDdMmYy(detailsSession.session_date)} · {formatHour(detailsSession.start_time, detailsSession.session_date)} - {formatHour(detailsSession.end_time, detailsSession.session_date)}
              </p>
              {isDetailsSessionPast ? (
                <p className="calendar-bookings-modal-capacity">Clase pasada: solo lectura.</p>
              ) : null}
              <p className="calendar-bookings-modal-capacity">
                Ocupación: {activeBookingsCount}/{detailsSession.capacity}
              </p>

              {bookingsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="calendar-bookings-empty">No hay alumnos apuntados.</p>
              ) : (
                <div className="calendar-bookings-list">
                  {bookings.map(booking => (
                    <div key={booking.id} className="calendar-booking-item">
                      <div>
                        <div className="calendar-booking-name">{booking.user_name || `Alumno #${booking.user_id}`}</div>
                        <div className="calendar-booking-email">{booking.user_email || 'Sin email disponible'}</div>
                        <div className={`calendar-booking-status ${booking.status === 'active' ? 'active' : 'cancelled'}`}>
                          {booking.status === 'active' ? 'Activa' : 'Inactiva'}
                        </div>
                      </div>
                      {(userRole === 'admin' || userRole === 'trainer') && !isDetailsSessionPast ? (
                        booking.status === 'active' ? (
                          <button className="calendar-booking-action-cancel" onClick={() => handleCancelBooking(booking.id)}>
                            Cancelar
                          </button>
                        ) : (
                          <button className="calendar-booking-action-reactivate" onClick={() => handleReactivateBooking(booking.id)}>
                            Reactivar
                          </button>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
          <div className="calendar-hour-modal-actions">
            <button className="calendar-hour-modal-cancel" onClick={() => setShowDetailsModal(false)}>Cerrar</button>
          </div>
        </div>
      </IonModal>

      <CustomToast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
        type={toast.type}
        duration={3000}
      />
    </div>
  );
};

export default Calendar;
