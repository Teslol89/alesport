/* Buscador avanzado de reservas para admins, con filtros por texto y fecha, y resumen de resultados. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import logoIcon from '../icons/icon.png';
import { IonDatetime, IonModal, IonSpinner, useIonViewWillEnter } from '@ionic/react';
import { BookingItem, getAllBookings } from '../api/bookings';
import { formatDateDdMmYy, formatHour, isSameDay, isSameWeek, toLocalISODate } from '../utils/funcionesGeneral';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';
import './BuscarForm.css';

type PeriodFilter = 'all' | 'today' | 'week' | 'month';

const SEARCH_AUTO_REFRESH_MS = 10000;

const BuscarForm: React.FC = () => {
    const { t, dateLocale } = useLanguage();
    const { role: userRole, isLoadingProfile } = useAuth();
    const todayIso = toLocalISODate(new Date());
    const [bookings, setBookings] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [periodDate, setPeriodDate] = useState<string>(() => toLocalISODate(new Date()));
    const [showPeriodCalendar, setShowPeriodCalendar] = useState(false);
    // Barra de búsqueda siempre visible, sin lupa

    const loadBookings = useCallback((options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;

        if (isLoadingProfile) {
            return;
        }

        if (userRole !== 'admin') {
            setBookings([]);
            setLoading(false);
            return;
        }

        if (!silent) {
            setLoading(true);
        }
        setError(null);

        getAllBookings()
            .then(data => setBookings(data))
            .catch(() => setError(t('search.loadError')))
            .finally(() => {
                if (!silent) {
                    setLoading(false);
                }
            });
    }, [isLoadingProfile, t, userRole]);

    useEffect(() => {
        loadBookings();
    }, [loadBookings]);

    useIonViewWillEnter(() => {
        loadBookings({ silent: true });
    }, [loadBookings]);

    useEffect(() => {
        if (isLoadingProfile || userRole !== 'admin') {
            return;
        }

        const refreshSearchState = () => {
            if (document.visibilityState !== 'visible') {
                return;
            }

            loadBookings({ silent: true });
        };

        const intervalId = window.setInterval(refreshSearchState, SEARCH_AUTO_REFRESH_MS);
        window.addEventListener('focus', refreshSearchState);
        document.addEventListener('visibilitychange', refreshSearchState);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshSearchState);
            document.removeEventListener('visibilitychange', refreshSearchState);
        };
    }, [isLoadingProfile, loadBookings, userRole]);

    const filteredBookings = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return bookings;

        return bookings.filter(b => {
            const byName = (b.user_name || '').toLowerCase().includes(q);
            const byEmail = (b.user_email || '').toLowerCase().includes(q);
            const statusText = (
                b.status === 'active'
                    ? t('search.statusActive')
                    : b.status === 'waitlist'
                        ? t('search.statusWaitlist')
                        : b.status === 'offered'
                            ? t('search.statusOffered')
                            : t('search.statusCancelled')
            ).toLowerCase();
            const byStatus = statusText.includes(q);
            return byName || byEmail || byStatus;
        });
    }, [bookings, query, t]);

    const periodFilteredBookings = useMemo(() => {
        if (periodFilter === 'all') {
            return filteredBookings;
        }

        const effectivePeriodDate = periodFilter === 'today' ? todayIso : periodDate;
        const base = new Date(`${effectivePeriodDate}T00:00:00`);
        if (isNaN(base.getTime())) {
            return filteredBookings;
        }

        return filteredBookings.filter((booking) => {
            const referenceDateStr = booking.session_start_time || booking.created_at;
            const referenceDate = new Date(referenceDateStr);
            if (isNaN(referenceDate.getTime())) {
                return false;
            }

            if (periodFilter === 'month') {
                return referenceDate.getFullYear() === base.getFullYear() && referenceDate.getMonth() === base.getMonth();
            }

            if (periodFilter === 'today') {
                return isSameDay(base, referenceDate);
            }

            return isSameWeek(base, referenceDate);
        });
    }, [filteredBookings, periodFilter, periodDate]);

    const bookingSummary = useMemo(() => {
        const active = periodFilteredBookings.filter((booking) => booking.status === 'active').length;
        const inactive = periodFilteredBookings.length - active;
        return {
            total: periodFilteredBookings.length,
            active,
            inactive,
        };
    }, [periodFilteredBookings]);

    return (
        <div className="search-form-container">
            <div className="search-top-bar">
                <img src={logoIcon} alt="Logo gimnasio" className="search-top-logo" />
                <div className="search-top-title search-top-title-absolute">{t('search.title')}</div>
            </div>
            {/* Contenido principal de la búsqueda */}
            <div className="search-form-content">
                {isLoadingProfile ? (
                    <div className="search-form-loading">
                        <IonSpinner name="crescent" color="primary" />
                    </div>
                ) : userRole !== 'admin' ? (
                    <p className="search-form-empty">{t('search.adminOnly')}</p>
                ) : (
                    <div className="search-form-body">
                        <input
                            className="search-form-search-input"
                            placeholder={t('search.placeholder')}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />

                        <div className="search-form-filters-row">
                            <select
                                className="search-form-period-select"
                                value={periodFilter}
                                onChange={(e) => {
                                    const nextFilter = e.target.value as PeriodFilter;
                                    setPeriodFilter(nextFilter);
                                    if (nextFilter === 'today') {
                                        setPeriodDate(todayIso);
                                    }
                                }}
                            >
                                <option value="all">{t('search.all')}</option>
                                <option value="today">{t('search.today')}</option>
                                <option value="week">{t('search.week')}</option>
                                <option value="month">{t('search.month')}</option>
                            </select>
                            {periodFilter !== 'all' && periodFilter !== 'today' ? (
                                <button
                                    type="button"
                                    className="search-form-period-date-btn"
                                    onClick={() => setShowPeriodCalendar(true)}
                                >
                                    {formatDateDdMmYy(periodDate)}
                                </button>
                            ) : null}
                        </div>

                        <IonModal
                            className="search-form-date-modal-wrapper"
                            isOpen={showPeriodCalendar}
                            onDidDismiss={() => setShowPeriodCalendar(false)}
                        >
                            <div className="search-form-date-modal">
                                <h4>{t('search.selectDate')}</h4>
                                <IonDatetime
                                    className="search-form-date-calendar"
                                    presentation="date"
                                    firstDayOfWeek={1}
                                    locale={dateLocale}
                                    value={periodDate}
                                    onIonChange={(e) => {
                                        const next = e.detail.value;
                                        if (typeof next === 'string') {
                                            setPeriodDate(next.slice(0, 10));
                                        }
                                    }}
                                />
                                <div className="search-form-date-modal-actions">
                                    <button type="button" className="app-btn-primary" onClick={() => setShowPeriodCalendar(false)}>
                                        {t('common.accept')}
                                    </button>
                                    <button type="button" className="app-btn-danger" onClick={() => setShowPeriodCalendar(false)}>
                                        {t('common.cancel')}
                                    </button>
                                </div>
                            </div>
                        </IonModal>

                        {!loading && !error ? (
                            <div className="search-form-summary">
                                <span className="search-form-summary-total">{bookingSummary.total} {t('search.total')}</span>
                                <span className="search-form-summary-separator">·</span>
                                <span className="search-form-summary-active">{bookingSummary.active} {t('search.active')}</span>
                                <span className="search-form-summary-separator">·</span>
                                <span className="search-form-summary-inactive">{bookingSummary.inactive} {t('search.cancelled')}</span>
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="search-form-loading">
                                <IonSpinner name="crescent" color="primary" />
                            </div>
                        ) : error ? (
                            <p className="search-form-error">{error}</p>
                        ) : periodFilteredBookings.length === 0 ? (
                            <p className="search-form-empty">{t('search.empty')}</p>
                        ) : (
                            <div className="search-form-list">
                                {periodFilteredBookings.map((booking) => {
                                    const statusLabel = booking.status === 'active'
                                        ? t('search.statusActive')
                                        : booking.status === 'waitlist'
                                            ? t('search.statusWaitlist')
                                            : booking.status === 'offered'
                                                ? t('search.statusOffered')
                                                : t('search.statusCancelled');
                                    const statusClass = booking.status === 'active'
                                        ? 'active'
                                        : booking.status === 'waitlist'
                                            ? 'waiting'
                                            : booking.status === 'offered'
                                                ? 'offered'
                                                : 'inactive';

                                    return (
                                        <div key={booking.id} className="search-form-item">
                                            <div className="search-form-item-name">{booking.user_name || `${t('search.student')} #${booking.user_id}`}</div>
                                            <div className="search-form-item-email">{booking.user_email || t('search.noEmail')}</div>
                                            <div className="search-form-item-meta">
                                                <strong>{t('search.status')}:</strong> <span className={`search-form-status-badge ${statusClass}`}>{statusLabel}</span>
                                                <span className="search-form-item-meta-separator">·</span>
                                                <strong>{t('search.time')}:</strong> {formatHour(booking.session_start_time || booking.created_at)}
                                                <span className="search-form-item-meta-separator">·</span>
                                                <strong>{t('search.date')}:</strong> {formatDateDdMmYy(booking.session_start_time || booking.created_at)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuscarForm;
