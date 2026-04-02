import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonModal, IonSpinner, IonDatetime, useIonViewWillEnter } from '@ionic/react';
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
import { getSessionsByDateRange, updateSession, cancelSession } from '../api/sessions';
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
    class_name?: string;
    notes?: string | null;
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
  const [editClassName, setEditClassName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCapacity, setEditCapacity] = useState(10);
  const [showCapacityPicker, setShowCapacityPicker] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [isTimePickerPresented, setIsTimePickerPresented] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
  const [timePickerValue, setTimePickerValue] = useState(`${TIME_PICKER_BASE_DATE}T08:00:00`);

  // Estado modal detalles/alumnos
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSession, setDetailsSession] = useState<SessionItem | null>(null);
  const [pendingEditSession, setPendingEditSession] = useState<SessionItem | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [sessionOccupancy, setSessionOccupancy] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' | 'info' }>({
    show: false,
    message: '',
    type: 'danger',
  });

  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const bookingsCacheRef = useRef<Record<number, BookingItem[]>>({});
  const bookingsInFlightRef = useRef<Record<number, Promise<BookingItem[]>>>({});

  const getSessionBookingsCached = useCallback(async (sessionId: number) => {
    const cached = bookingsCacheRef.current[sessionId];
    if (cached) {
      return cached;
    }

    const inFlight = bookingsInFlightRef.current[sessionId];
    if (inFlight) {
      return inFlight;
    }

    const request = getBookingsBySession(sessionId)
      .then((data) => {
        bookingsCacheRef.current[sessionId] = data;
        return data;
      })
      .finally(() => {
        delete bookingsInFlightRef.current[sessionId];
      });

    bookingsInFlightRef.current[sessionId] = request;
    return request;
  }, []);

  // Sincronizar selectedDate cuando se abre el modal de mes
  useEffect(() => {
    if (showMonthModal) {
      setSelectedDate(weekAnchorDate);
    }
  }, [showMonthModal, weekAnchorDate]);

  // Obtener rango de la semana actual
  const startDate = weekDays[0].date;
  const endDate = weekDays[6].date;

  const fetchSessions = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    getSessionsByDateRange(startDate, endDate)
      .then(data => setSessions(data as SessionItem[]))
      .catch(() => {
        if (!silent) {
          setError("No se pudieron cargar las sesiones");
        }
      })
      .finally(() => {
        if (!silent) {
          setLoading(false);
        }
      });
  }, [startDate, endDate]);

  // Cargar sesiones al montar y al cambiar semana
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // También refrescar al entrar en la vista Agenda (cambio de tab/ruta)
  useIonViewWillEnter(() => {
    fetchSessions({ silent: true });
  }, [startDate, endDate]);

  // Filtra y ordena sesiones por fecha seleccionada y hora de inicio
  const sessionsForDate = useMemo(
    () =>
      sessions
        .filter(s => s.session_date === selectedDate && s.status !== 'cancelled')
        .sort((a, b) => {
          const startA = formatHour(a.start_time, a.session_date, '00:00');
          const startB = formatHour(b.start_time, b.session_date, '00:00');
          return startA.localeCompare(startB);
        }),
    [sessions, selectedDate],
  );

  const fechaES = formatFullDateES(selectedDate);

  function openEditSessionModal(session: SessionItem) {
    if (isPastSession(session)) {
      setToast({ show: true, message: 'No se pueden modificar sesiones de días pasados', type: 'danger' });
      return;
    }

    const start = formatHour(session.start_time, session.session_date);
    const end = formatHour(session.end_time, session.session_date);
    setEditingSession(session);
    setNewStartTime(start !== '-' ? start : '');
    setNewEndTime(end !== '-' ? end : '');
    setEditClassName(session.class_name || '');
    setEditNotes(session.notes || '');
    setEditCapacity(session.capacity);
    setShowCapacityPicker(false);

    if (showDetailsModal) {
      setPendingEditSession(session);
      setShowDetailsModal(false);
      return;
    }

    setShowHourModal(true);
  }

  async function openDetailsModal(session: SessionItem) {
    const cachedBookings = bookingsCacheRef.current[session.id];
    setBookings(cachedBookings || []);
    setBookingsLoading(!cachedBookings);
    setDetailsSession(session);
    setShowDetailsModal(true);

    if (cachedBookings) {
      return;
    }

    try {
      const data = await getSessionBookingsCached(session.id);
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
      setBookings(prev => {
        const next = prev.map(b => (b.id === bookingId ? { ...b, status: 'cancelled' } : b));
        if (detailsSession) {
          bookingsCacheRef.current[detailsSession.id] = next;
        }
        return next;
      });
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
      setBookings(prev => {
        const next = prev.map(b => (b.id === bookingId ? { ...b, status: 'active' } : b));
        if (detailsSession) {
          bookingsCacheRef.current[detailsSession.id] = next;
        }
        return next;
      });
      setToast({ show: true, message: 'Reserva reactivada correctamente', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo reactivar la reserva';
      setToast({ show: true, message, type: 'danger' });
    }
  }

  async function handleDeleteSession(sessionToDelete?: SessionItem | null) {
    const session = sessionToDelete ?? detailsSession;
    if (!session) return;

    if (!window.confirm('¿Seguro que deseas eliminar esta sesión? No se puede deshacer.')) {
      return;
    }

    try {
      await cancelSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      setSessionOccupancy(prev => {
        const next = { ...prev };
        delete next[session.id];
        return next;
      });
      delete bookingsCacheRef.current[session.id];
      delete bookingsInFlightRef.current[session.id];
      setDetailsSession(prev => (prev?.id === session.id ? null : prev));
      setEditingSession(prev => (prev?.id === session.id ? null : prev));
      setShowHourModal(false);
      setShowDetailsModal(false);
      setToast({ show: true, message: 'Sesión eliminada correctamente', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la sesión';
      setToast({ show: true, message, type: 'danger' });
    }
  }

  async function handleSaveSession() {
    if (!editingSession) {
      return;
    }

    const trimmedClassName = editClassName.trim();
    if (!trimmedClassName) {
      setToast({ show: true, message: 'El nombre de la clase es obligatorio', type: 'danger' });
      return;
    }

    if (!newStartTime || !newEndTime || newStartTime >= newEndTime) {
      setToast({ show: true, message: 'La hora de inicio debe ser anterior a la de fin', type: 'danger' });
      return;
    }

    if (!Number.isInteger(editCapacity) || editCapacity < 1 || editCapacity > 10) {
      setToast({ show: true, message: 'La capacidad debe estar entre 1 y 10', type: 'danger' });
      return;
    }

    try {
      const updated = await updateSession(editingSession.id, {
        start_time: newStartTime,
        end_time: newEndTime,
        capacity: editCapacity,
        class_name: trimmedClassName,
        notes: editNotes.trim(),
      });

      setSessions(prev => prev.map(session => (
        session.id === editingSession.id
          ? {
            ...session,
            ...updated,
          }
          : session
      )));

      setDetailsSession(prev => (
        prev && prev.id === editingSession.id
          ? {
            ...prev,
            ...updated,
          }
          : prev
      ));

      setShowHourModal(false);
      setEditingSession(null);
      setShowCapacityPicker(false);
      setToast({ show: true, message: 'Sesión actualizada correctamente', type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al actualizar la sesión';
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
            const sessionBookings = await getSessionBookingsCached(session.id);
            const activeCount = sessionBookings.filter(b => b.status === 'active').length;
            return [session.id, activeCount] as const;
          } catch {
            return [session.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setSessionOccupancy(prev => {
          let changed = false;
          const next = { ...prev };
          for (const [sessionId, count] of occupancyEntries) {
            if (next[sessionId] !== count) {
              next[sessionId] = count;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    };

    if (sessionsForDate.length > 0) {
      loadOccupancy();
    }

    return () => {
      cancelled = true;
    };
  }, [sessionsForDate, userRole, getSessionBookingsCached]);

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
  const loadingSkeletonRows = [1, 2, 3];

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
            const hasClassName = Boolean(session.class_name && session.class_name.trim().length > 0);
            const hasNotes = Boolean(session.notes && session.notes.trim().length > 0);
            return (
              <IonCard key={session.id} className={cardClass}>
                <IonCardHeader>
                  <IonCardTitle>
                    {hasClassName ? (
                      <p className="session-class-name">{session.class_name}</p>
                    ) : null}
                    <div className="session-title-row-flex">
                      <span className="session-title-custom session-title-row">
                        <img src={horaIcon} alt="Hora" className="session-title-icon" />
                        {formatHour(session.start_time, session.session_date)} - {formatHour(session.end_time, session.session_date)}
                      </span>
                      {session.trainer_name ? (
                        <span className="session-title-trainer">{session.trainer_name}</span>
                      ) : null}
                    </div>
                  </IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <div className='session-small-title-custom session-aforo-row'>
                    <img src={aforoIcon} alt="Aforo" className="session-aforo-icon" />
                    {`${occupancy}/${session.capacity}`}
                    <div className='calendar-details-btn-container'>
                      <button className="calendar-details-btn" title="Detalles" onClick={() => openDetailsModal(session)}>
                        <img src={infoIcon} alt="Detalles" className="calendar-details-btn-icon" />
                      </button>
                    </div>
                  </div>
                  {hasNotes ? (
                    <p className="session-class-notes">{session.notes}</p>
                  ) : null}
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
      <IonModal className="calendar-hour-modal-wrapper" isOpen={showHourModal} focusTrap={false} onDidDismiss={() => {
        setShowHourModal(false);
        setEditingSession(null);
        setShowCapacityPicker(false);
        setIsTimePickerPresented(false);
      }}>
        <div className={`calendar-hour-modal ${isTimePickerPresented ? 'calendar-hour-modal--dimmed' : ''}`}>
          <h3>Editar sesión</h3>
          <p className="calendar-hour-modal-subtitle">Ajusta horario, capacidad y detalles de la clase</p>
          <div className="calendar-edit-session-block">
            <label className="calendar-hour-modal-label">
              <span>Nombre de la clase</span>
              <input
                type="text"
                className="app-input calendar-edit-text-input"
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                maxLength={120}
                placeholder="Ej. Funcional"
              />
            </label>
          </div>
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
          <div className="calendar-edit-session-block">
            <label className="calendar-hour-modal-label">
              <span>Capacidad</span>
              <button
                type="button"
                className="calendar-hour-picker-field"
                onClick={() => setShowCapacityPicker(prev => !prev)}
              >
                {editCapacity}
              </button>
              {showCapacityPicker ? (
                <div className="calendar-capacity-picker-panel">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`calendar-capacity-option ${editCapacity === value ? 'selected' : ''}`}
                      onClick={() => {
                        setEditCapacity(value);
                        setShowCapacityPicker(false);
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>
          </div>
          <div className="calendar-edit-session-block">
            <label className="calendar-hour-modal-label">
              <span>Notas</span>
              <textarea
                className="app-input calendar-edit-textarea"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Indicaciones internas u observaciones"
              />
            </label>
          </div>
          <div className="calendar-hour-modal-actions">
            <button onClick={handleSaveSession} className="calendar-hour-modal-save">Guardar</button>
            <button onClick={() => setShowHourModal(false)} className="calendar-hour-modal-cancel">Cerrar</button>
          </div>
          {editingSession ? (
            <div className="calendar-modal-danger-zone">
              <button onClick={() => handleDeleteSession(editingSession)} className="calendar-hour-modal-delete">Eliminar sesión</button>
            </div>
          ) : null}
        </div>
      </IonModal>

      {/* Modal del time picker reutilizable para inicio y fin */}
      <IonModal
        className="calendar-time-picker-modal-wrapper"
        isOpen={showTimePickerModal}
        onWillPresent={() => setIsTimePickerPresented(true)}
        onWillDismiss={() => setIsTimePickerPresented(false)}
        onDidDismiss={() => setShowTimePickerModal(false)}
      >
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
      <IonModal
        className="calendar-bookings-modal-wrapper"
        isOpen={showDetailsModal}
        keepContentsMounted={true}
        onDidDismiss={() => {
          setShowDetailsModal(false);
          if (pendingEditSession) {
            setPendingEditSession(null);
            setShowHourModal(true);
          }
        }}
      >
        <div className="calendar-bookings-modal">
          <h3>Detalles de la clase</h3>
          {detailsSession ? (
            <>
              {detailsSession.class_name ? (
                <p className="calendar-bookings-modal-class-name">{detailsSession.class_name}</p>
              ) : null}
              <p className="calendar-bookings-modal-subtitle">
                {formatDateDdMmYy(detailsSession.session_date)} · {formatHour(detailsSession.start_time, detailsSession.session_date)} - {formatHour(detailsSession.end_time, detailsSession.session_date)}
              </p>
              {isDetailsSessionPast ? (
                <p className="calendar-bookings-modal-capacity">Clase pasada: solo lectura.</p>
              ) : null}
              <p className="calendar-bookings-modal-capacity">
                Ocupación: {activeBookingsCount}/{detailsSession.capacity}
              </p>
              {detailsSession.notes ? (
                <p className="calendar-bookings-modal-notes">{detailsSession.notes}</p>
              ) : null}

              <div className="calendar-bookings-body">
                {bookingsLoading ? (
                  <div className="calendar-bookings-loading" aria-live="polite" aria-busy="true">
                    <IonSpinner name="crescent" color="primary" />
                    <div className="calendar-bookings-skeleton-list" aria-hidden="true">
                      {loadingSkeletonRows.map((row) => (
                        <div key={row} className="calendar-bookings-skeleton-item">
                          <div className="calendar-bookings-skeleton-line calendar-bookings-skeleton-line--name" />
                          <div className="calendar-bookings-skeleton-line calendar-bookings-skeleton-line--email" />
                        </div>
                      ))}
                    </div>
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
              </div>
            </>
          ) : null}
          <div className="calendar-hour-modal-actions">
            {(userRole === 'admin' || userRole === 'trainer') && !isDetailsSessionPast && detailsSession ? (
              <button className="calendar-hour-modal-save" onClick={() => openEditSessionModal(detailsSession)}>
                Editar Sesión
              </button>
            ) : null}
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
