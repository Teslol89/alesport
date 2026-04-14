import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonModal, IonSpinner, useIonViewWillEnter } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import logoIcon from '../icons/icon.png';
import { BookingItem, cancelBooking, getBookingsByUser, reactivateBooking } from '../api/bookings';
import { getSessionsByDateRange } from '../api/sessions';
import { useAuth } from './AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import CustomToast from './CustomStyles';
import './BuscarForm.css';
import './ReservasForm.css';

type SessionSummary = {
  id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  class_name?: string;
  trainer_name?: string | null;
  status?: string;
};

type ReservasFormProps = {
  refreshSignal?: number;
};

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 120;
const BOOKINGS_AUTO_REFRESH_MS = 10000;

function shiftDays(base: Date, amount: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hasMinimumCancellationNotice(session?: SessionSummary) {
  if (!session) {
    return true;
  }

  const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
  if (Number.isNaN(sessionStart.getTime())) {
    return true;
  }

  return sessionStart.getTime() - Date.now() >= 2 * 60 * 60 * 1000;
}

const ReservasForm: React.FC<ReservasFormProps> = ({ refreshSignal = 0 }) => {
  const { user, refreshProfile } = useAuth();
  const { t, dateLocale } = useLanguage();
  const history = useHistory();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [sessionsById, setSessionsById] = useState<Record<number, SessionSummary>>({});
  const [loading, setLoading] = useState(true);
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [pendingCancelBooking, setPendingCancelBooking] = useState<BookingItem | null>(null);
  const [offerClockMs, setOfferClockMs] = useState(() => Date.now());
  const hasLoadedBookingsRef = useRef(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' | 'info' }>({
    show: false,
    message: '',
    type: 'info',
  });

  const loadBookings = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user?.id) {
      setBookings([]);
      setSessionsById({});
      setLoading(false);
      hasLoadedBookingsRef.current = true;
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    hasLoadedBookingsRef.current = true;

    try {
      const today = new Date();
      const [bookingData, sessionData] = await Promise.all([
        getBookingsByUser(user.id),
        getSessionsByDateRange(
          toIsoDate(shiftDays(today, -LOOKBACK_DAYS)),
          toIsoDate(shiftDays(today, LOOKAHEAD_DAYS))
        ),
      ]);

      const sessionMap = (sessionData as SessionSummary[]).reduce<Record<number, SessionSummary>>((acc, session) => {
        acc[session.id] = session;
        return acc;
      }, {});

      setBookings(bookingData);
      setSessionsById(sessionMap);
      hasLoadedBookingsRef.current = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t('myBookings.empty');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [t, user?.id]);

  useEffect(() => {
    void loadBookings({ silent: hasLoadedBookingsRef.current });
  }, [loadBookings, refreshSignal]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const refreshBookingsState = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (!user.is_active || !user.membership_active) {
        void refreshProfile();
      }

      void loadBookings({ silent: true });
    };

    const intervalId = window.setInterval(refreshBookingsState, BOOKINGS_AUTO_REFRESH_MS);
    window.addEventListener('focus', refreshBookingsState);
    document.addEventListener('visibilitychange', refreshBookingsState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshBookingsState);
      document.removeEventListener('visibilitychange', refreshBookingsState);
    };
  }, [loadBookings, refreshProfile, user?.id, user?.is_active, user?.membership_active]);

  useIonViewWillEnter(() => {
    if (user && (!user.is_active || !user.membership_active)) {
      void refreshProfile();
    }
    void loadBookings({ silent: true });
  }, [loadBookings, refreshProfile, user]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setOfferClockMs(Date.now()), 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleBookings = useMemo(() => {
    return bookings
      .filter((booking) => booking.status === 'active' || booking.status === 'waitlist' || booking.status === 'offered')
      .sort((a, b) => {
        const aSession = sessionsById[a.session_id];
        const bSession = sessionsById[b.session_id];
        const aDate = aSession ? `${aSession.session_date}T${aSession.start_time}` : a.session_start_time || a.created_at;
        const bDate = bSession ? `${bSession.session_date}T${bSession.start_time}` : b.session_start_time || b.created_at;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });
  }, [bookings, sessionsById]);

  function hasSessionStarted(session?: SessionSummary) {
    if (!session) {
      return false;
    }

    const sessionStart = new Date(`${session.session_date}T${session.start_time}`);
    if (!Number.isNaN(sessionStart.getTime())) {
      return sessionStart.getTime() <= Date.now();
    }

    return session.session_date < toIsoDate(new Date());
  }

  function getBookingDateParts(booking: BookingItem) {
    const session = sessionsById[booking.session_id];
    const rawDate = session ? `${session.session_date}T${session.start_time}` : booking.session_start_time;

    if (!rawDate) {
      return {
        dateText: t('myBookings.sessionLabel'),
        timeText: '',
      };
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return {
        dateText: t('myBookings.sessionLabel'),
        timeText: '',
      };
    }

    const formattedDate = new Intl.DateTimeFormat(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed);

    const formattedTime = new Intl.DateTimeFormat(dateLocale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);

    return {
      dateText: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
      timeText: formattedTime,
    };
  }

  function formatOfferCountdown(offerExpiresAt?: string | null) {
    if (!offerExpiresAt) {
      return '00:00';
    }

    const remainingMs = new Date(offerExpiresAt).getTime() - offerClockMs;
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return '00:00';
    }

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  async function handleCancelBooking(booking: BookingItem, confirmed = false) {
    const session = sessionsById[booking.session_id];
    const isPast = hasSessionStarted(session);

    if (isPast) {
      setToast({ show: true, message: t('calendar.pastClassReadOnly'), type: 'info' });
      return;
    }

    if (!hasMinimumCancellationNotice(session)) {
      setToast({ show: true, message: t('calendar.cancelDeadlinePassed'), type: 'danger' });
      return;
    }

    if (!confirmed) {
      setPendingCancelBooking(booking);
      return;
    }

    setPendingCancelBooking(null);
    setBusyBookingId(booking.id);
    try {
      await cancelBooking(booking.id);
      setBookings((current) => current.map((item) => (
        item.id === booking.id ? { ...item, status: 'cancelled' } : item
      )));
      setToast({ show: true, message: t('calendar.bookingCancelled'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('calendar.bookingCancelError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      setBusyBookingId(null);
    }
  }

  async function handleConfirmBooking(booking: BookingItem) {
    const session = sessionsById[booking.session_id];
    const isPast = hasSessionStarted(session);

    if (isPast) {
      setToast({ show: true, message: t('calendar.pastClassReadOnly'), type: 'info' });
      return;
    }

    setBusyBookingId(booking.id);
    try {
      await reactivateBooking(booking.id);
      setBookings((current) => current.map((item) => (
        item.id === booking.id ? { ...item, status: 'active', offer_expires_at: null } : item
      )));
      setToast({ show: true, message: t('calendar.spotConfirmed'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('calendar.offerExpired');
      setToast({ show: true, message, type: 'danger' });
      await loadBookings();
    } finally {
      setBusyBookingId(null);
    }
  }


  // Bloqueo por membresía inactiva o sin plan
  if (user && (!user.is_active || !user.membership_active)) {
    return (
      <div className="bookings-form-container app-blur-target">
        <div className="bookings-top-bar">
          <img src={logoIcon} alt="Logo gimnasio" className="bookings-top-logo" />
          <div className="bookings-top-title bookings-top-title-absolute">{t('myBookings.title')}</div>
        </div>
        <div className="bookings-form-wrapper">
          <div className="bookings-empty app-surface-card">
            <p className="bookings-form-blocked">
              { !user.is_active
                ? t('auth.inactiveUserBlocked')
                : t('auth.membershipInactiveBlocked') }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bookings-form-container app-blur-target ${pendingCancelBooking ? 'app-blur-target--modal-open' : ''}`}>
      <div className="bookings-top-bar">
        <img src={logoIcon} alt="Logo gimnasio" className="bookings-top-logo" />
        <div className="bookings-top-title bookings-top-title-absolute">{t('myBookings.title')}</div>
      </div>

      <div className="bookings-form-wrapper">
        {loading ? (
          <div className="bookings-loading" aria-live="polite" aria-busy="true">
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="bookings-empty app-surface-card">
            <p>{t('myBookings.empty')}</p>
          </div>
        ) : (
          <div className="bookings-list">
            {visibleBookings.map((booking) => {
              const session = sessionsById[booking.session_id];
              const isPast = hasSessionStarted(session);
              const isWaitlist = booking.status === 'waitlist';
              const isOffered = booking.status === 'offered';
              const { dateText, timeText } = getBookingDateParts(booking);
              const className = session?.class_name?.trim() || 'Clase sin nombre';

              return (
                <article key={booking.id} className="bookings-item app-surface-card">
                  <div className="bookings-item-main">
                    <div className="bookings-item-header">
                      <h2>{className}</h2>
                      <span className={`bookings-badge${isWaitlist ? ' bookings-badge--waitlist' : isOffered ? ' bookings-badge--offered' : ''}`}>
                        {isWaitlist ? t('calendar.waitlist') : isOffered ? t('calendar.offered') : t('calendar.bookedByYou')}
                      </span>
                    </div>
                    <p className="bookings-date">{dateText}</p>
                    {timeText ? <p className="bookings-time">{timeText}</p> : null}
                    {session?.trainer_name ? (
                      <p className="bookings-meta">
                        <strong>{t('calendar.trainer')}:</strong> {session.trainer_name}
                      </p>
                    ) : null}
                    {isOffered ? (
                      <p className="bookings-offer-timer">
                        {t('calendar.offerTimeLeft')}: {formatOfferCountdown(booking.offer_expires_at)}
                      </p>
                    ) : null}
                  </div>

                  <div className="bookings-item-actions">
                    {isPast ? (
                      <span className="calendar-client-status calendar-client-status--muted">
                        {t('calendar.pastClassReadOnly')}
                      </span>
                    ) : isOffered ? (
                      <button
                        className="app-btn-primary"
                        onClick={() => { void handleConfirmBooking(booking); }}
                        disabled={busyBookingId === booking.id}
                      >
                        {busyBookingId === booking.id ? t('common.loading') : t('calendar.confirmSpot')}
                      </button>
                    ) : (
                      <button
                        className="app-btn-danger calendar-booking-action-cancel"
                        onClick={() => { void handleCancelBooking(booking); }}
                        disabled={busyBookingId === booking.id}
                      >
                        {busyBookingId === booking.id ? t('common.loading') : t('calendar.cancelMyBooking')}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <IonModal
        className="bookings-confirm-modal-wrapper"
        isOpen={Boolean(pendingCancelBooking)}
        onDidDismiss={() => setPendingCancelBooking(null)}
      >
        <div className="app-modal-panel bookings-confirm-modal">
          <h3>{t('calendar.cancelMyBooking')}</h3>
          <p>{t('calendar.confirmCancelMyBooking')}</p>
          <div className="app-stack-actions bookings-confirm-actions">
            <button
              className="app-btn-danger"
              onClick={() => {
                if (pendingCancelBooking) {
                  void handleCancelBooking(pendingCancelBooking, true);
                }
              }}
              disabled={busyBookingId === pendingCancelBooking?.id}
            >
              {busyBookingId === pendingCancelBooking?.id ? t('common.loading') : t('calendar.cancelMyBooking')}
            </button>
            <button
              className="app-btn-secondary"
              onClick={() => setPendingCancelBooking(null)}
              disabled={busyBookingId === pendingCancelBooking?.id}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </IonModal>

      <CustomToast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast((current) => ({ ...current, show: false }))}
        type={toast.type}
        placement="top"
        duration={2800}
      />
    </div>
  );
};

export default ReservasForm;
