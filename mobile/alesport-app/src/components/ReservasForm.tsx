import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IonModal, IonSpinner } from '@ionic/react';
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

function shiftDays(base: Date, amount: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const ReservasForm: React.FC<ReservasFormProps> = ({ refreshSignal = 0 }) => {
  const { user } = useAuth();
  const { t, dateLocale } = useLanguage();
  const history = useHistory();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [sessionsById, setSessionsById] = useState<Record<number, SessionSummary>>({});
  const [loading, setLoading] = useState(true);
  const [busyBookingId, setBusyBookingId] = useState<number | null>(null);
  const [pendingCancelBooking, setPendingCancelBooking] = useState<BookingItem | null>(null);
  const [offerClockMs, setOfferClockMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' | 'info' }>({
    show: false,
    message: '',
    type: 'info',
  });

  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setBookings([]);
      setSessionsById({});
      setLoading(false);
      return;
    }

    setLoading(true);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : t('myBookings.empty');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings, refreshSignal]);

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

  const todayIso = toIsoDate(new Date());

  function formatBookingDate(booking: BookingItem) {
    const session = sessionsById[booking.session_id];
    const rawDate = session ? `${session.session_date}T${session.start_time}` : booking.session_start_time;

    if (!rawDate) {
      return `${t('myBookings.sessionLabel')} #${booking.session_id}`;
    }

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) {
      return `${t('myBookings.sessionLabel')} #${booking.session_id}`;
    }

    return new Intl.DateTimeFormat(dateLocale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
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
    const isPast = session ? session.session_date < todayIso : false;

    if (isPast) {
      setToast({ show: true, message: t('calendar.pastClassReadOnly'), type: 'info' });
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
    const isPast = session ? session.session_date < todayIso : false;

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

  return (
    <div className="bookings-form-container">
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
            <button className="bookings-primary-btn" onClick={() => history.push('/admin-calendar')}>
              {t('myBookings.goToAgenda')}
            </button>
          </div>
        ) : (
          <div className="bookings-list">
            {visibleBookings.map((booking) => {
              const session = sessionsById[booking.session_id];
              const isPast = session ? session.session_date < todayIso : false;
              const isWaitlist = booking.status === 'waitlist';
              const isOffered = booking.status === 'offered';

              return (
                <article key={booking.id} className="bookings-item app-surface-card">
                  <div className="bookings-item-main">
                    <span className={`bookings-badge${isWaitlist ? ' bookings-badge--waitlist' : isOffered ? ' bookings-badge--offered' : ''}`}>
                      {isWaitlist ? t('calendar.waitlist') : isOffered ? t('calendar.offered') : t('calendar.bookedByYou')}
                    </span>
                    <h2>{session?.class_name || `${t('myBookings.sessionLabel')} #${booking.session_id}`}</h2>
                    <p className="bookings-date">{formatBookingDate(booking)}</p>
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
