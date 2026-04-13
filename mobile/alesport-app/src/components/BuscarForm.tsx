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

const getBookingReferenceDate = (booking: BookingItem): Date | null => {
    const referenceDateStr = booking.session_start_time || booking.created_at;
    const referenceDate = new Date(referenceDateStr);
    return Number.isNaN(referenceDate.getTime()) ? null : referenceDate;
};

const BuscarForm: React.FC = () => {
    const { t, dateLocale } = useLanguage();
    const { role: userRole, isLoadingProfile, user } = useAuth();
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';
    const todayIso = toLocalISODate(new Date());
    const [bookings, setBookings] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [periodDate, setPeriodDate] = useState<string>(() => toLocalISODate(new Date()));
    const [showPeriodCalendar, setShowPeriodCalendar] = useState(false);
    const [showPeriodFilterModal, setShowPeriodFilterModal] = useState(false);
    // Barra de búsqueda siempre visible, sin lupa

    const periodFilterLabel = useMemo(() => {
        if (periodFilter === 'today') return t('search.today');
        if (periodFilter === 'week') return t('search.week');
        if (periodFilter === 'month') return t('search.month');
        return t('search.all');
    }, [periodFilter, t]);

    const periodDateLabel = useMemo(() => {
        if (periodFilter !== 'month') {
            return formatDateDdMmYy(periodDate);
        }

        const baseDate = new Date(`${periodDate}T00:00:00`);
        if (Number.isNaN(baseDate.getTime())) {
            return formatDateDdMmYy(periodDate);
        }

        return baseDate.toLocaleDateString(dateLocale, {
            month: 'long',
            year: 'numeric',
        });
    }, [dateLocale, periodDate, periodFilter]);

    const handlePickPeriodFilter = (nextFilter: PeriodFilter) => {
        setPeriodFilter(nextFilter);
        if (nextFilter === 'today') {
            setPeriodDate(todayIso);
        }
        setShowPeriodFilterModal(false);
    };

    const loadBookings = useCallback((options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;

        if (isLoadingProfile) {
            return;
        }

        if (!isAdmin) {
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
    }, [isAdmin, isLoadingProfile, t]);

    useEffect(() => {
        loadBookings();
    }, [loadBookings]);

    useIonViewWillEnter(() => {
        loadBookings({ silent: true });
    }, [loadBookings]);

    useEffect(() => {
        if (isLoadingProfile || !isAdmin) {
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
    }, [isAdmin, isLoadingProfile, loadBookings]);

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
        let periodFiltered = filteredBookings;

        if (periodFilter !== 'all') {
            const effectivePeriodDate = periodFilter === 'today' ? todayIso : periodDate;
            const base = new Date(`${effectivePeriodDate}T00:00:00`);
            if (isNaN(base.getTime())) {
                periodFiltered = filteredBookings;
            } else {
                periodFiltered = filteredBookings.filter((booking) => {
                    const referenceDate = getBookingReferenceDate(booking);
                    if (!referenceDate) {
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
            }
        }

        return [...periodFiltered].sort((a, b) => {
            const dateA = getBookingReferenceDate(a);
            const dateB = getBookingReferenceDate(b);

            if (!dateA && !dateB) return a.id - b.id;
            if (!dateA) return 1;
            if (!dateB) return -1;

            const byDate = dateA.getTime() - dateB.getTime();
            if (byDate !== 0) return byDate;

            return a.id - b.id;
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

    // Bloqueo por membresía inactiva o sin plan (solo para usuarios no admin)
    if (user && (!user.is_active || !user.membership_active) && !isAdmin) {
        return (
            <div className={`search-form-container app-blur-target`}>
                <div className="search-top-bar">
                    <img src={logoIcon} alt="Logo gimnasio" className="search-top-logo" />
                    <div className="search-top-title search-top-title-absolute">{t('search.title')}</div>
                </div>
                <div className="search-form-content">
                    <p className="search-form-blocked">
                        { !user.is_active
                            ? t('auth.inactiveUserBlocked')
                            : t('auth.membershipInactiveBlocked') }
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`search-form-container app-blur-target ${(showPeriodCalendar || showPeriodFilterModal) ? 'app-blur-target--modal-open' : ''}`}>
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
                ) : !isAdmin ? (
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
                            <button
                                type="button"
                                className="search-form-period-select"
                                onClick={() => setShowPeriodFilterModal(true)}
                            >
                                {periodFilterLabel}
                            </button>
                            {periodFilter !== 'all' && periodFilter !== 'today' ? (
                                <button
                                    type="button"
                                    className="search-form-period-date-btn"
                                    onClick={() => setShowPeriodCalendar(true)}
                                >
                                    {periodDateLabel}
                                </button>
                            ) : null}
                        </div>

                        <IonModal
                            className="search-form-date-modal-wrapper"
                            isOpen={showPeriodFilterModal}
                            onDidDismiss={() => setShowPeriodFilterModal(false)}
                        >
                            <div className="search-form-date-modal">
                                <h4>{t('search.selectPeriod')}</h4>
                                <div className="search-form-period-modal-options">
                                    {([
                                        { value: 'all', label: t('search.all') },
                                        { value: 'today', label: t('search.today') },
                                        { value: 'week', label: t('search.week') },
                                        { value: 'month', label: t('search.month') },
                                    ] as Array<{ value: PeriodFilter; label: string }>).map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={`search-form-period-option ${periodFilter === option.value ? 'selected' : ''}`}
                                            onClick={() => handlePickPeriodFilter(option.value)}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </IonModal>

                        <IonModal
                            className="search-form-date-modal-wrapper"
                            isOpen={showPeriodCalendar}
                            onDidDismiss={() => setShowPeriodCalendar(false)}
                        >
                            <div className="search-form-date-modal">
                                <h4>{periodFilter === 'month' ? t('search.selectMonth') : t('search.selectDate')}</h4>
                                <IonDatetime
                                    className="search-form-date-calendar"
                                    presentation={periodFilter === 'month' ? 'month-year' : 'date'}
                                    firstDayOfWeek={1}
                                    locale={dateLocale}
                                    value={periodDate}
                                    isDateEnabled={periodFilter === 'week'
                                        ? (isoDate: string) => {
                                            const day = new Date(isoDate).getDay();
                                            return day === 1;
                                        }
                                        : undefined}
                                    onIonChange={(e) => {
                                        const next = e.detail.value;
                                        if (typeof next === 'string') {
                                            if (periodFilter === 'month') {
                                                const normalizedDate = new Date(next);
                                                if (!Number.isNaN(normalizedDate.getTime())) {
                                                    const year = normalizedDate.getFullYear();
                                                    const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
                                                    setPeriodDate(`${year}-${month}-01`);
                                                    return;
                                                }
                                            }

                                            if (periodFilter === 'week') {
                                                const normalizedDate = new Date(next);
                                                if (!Number.isNaN(normalizedDate.getTime()) && normalizedDate.getDay() === 1) {
                                                    setPeriodDate(next.slice(0, 10));
                                                    setShowPeriodCalendar(false);
                                                }
                                                return;
                                            }

                                            setPeriodDate(next.slice(0, 10));
                                            setShowPeriodCalendar(false);
                                        }
                                    }}
                                />
                                {periodFilter === 'month' ? (
                                    <div className="search-form-date-modal-actions">
                                        <button type="button" className="app-btn-primary" onClick={() => setShowPeriodCalendar(false)}>
                                            {t('common.accept')}
                                        </button>
                                        <button type="button" className="app-btn-danger" onClick={() => setShowPeriodCalendar(false)}>
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                ) : null}
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
