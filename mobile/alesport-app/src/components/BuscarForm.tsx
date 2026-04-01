/* Buscador avanzado de reservas para admins, con filtros por texto y fecha, y resumen de resultados. */
import { useEffect, useMemo, useState } from 'react';
import { IonDatetime, IonModal, IonSpinner } from '@ionic/react';
import { BookingItem, getAllBookings } from '../api/bookings';
import { getUserProfile } from '../api/user';
import './BuscarForm.css';

function mapBookingStatus(status: string) {
    return status === 'active' ? 'Activa' : 'Cancelada';
}

function formatDateDdMmYy(dateStr: string) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
}

function formatHour(dateStr: string) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function toLocalIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function inSameWeek(baseDate: Date, targetDate: Date) {
    const base = new Date(baseDate);
    const target = new Date(targetDate);
    base.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const day = base.getDay();
    const mondayOffset = (day + 6) % 7;
    const weekStart = new Date(base);
    weekStart.setDate(base.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return target >= weekStart && target <= weekEnd;
}

function inSameDay(baseDate: Date, targetDate: Date) {
    return baseDate.getFullYear() === targetDate.getFullYear()
        && baseDate.getMonth() === targetDate.getMonth()
        && baseDate.getDate() === targetDate.getDate();
}

type PeriodFilter = 'all' | 'today' | 'week' | 'month';

const BuscarForm: React.FC = () => {
    const todayIso = toLocalIsoDate(new Date());
    const [bookings, setBookings] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
    const [periodDate, setPeriodDate] = useState<string>(() => toLocalIsoDate(new Date()));
    const [showPeriodCalendar, setShowPeriodCalendar] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        getUserProfile(() => { })
            .then(profile => setUserRole(profile.role || null))
            .catch(() => setUserRole(null));
    }, []);

    useEffect(() => {
        if (userRole !== 'admin') {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        getAllBookings()
            .then(data => setBookings(data))
            .catch(() => setError('No se pudieron cargar las reservas'))
            .finally(() => setLoading(false));
    }, [userRole]);

    const filteredBookings = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return bookings;

        return bookings.filter(b => {
            const byName = (b.user_name || '').toLowerCase().includes(q);
            const byEmail = (b.user_email || '').toLowerCase().includes(q);
            const statusText = mapBookingStatus(b.status).toLowerCase();
            const byStatus = statusText.includes(q);
            return byName || byEmail || byStatus;
        });
    }, [bookings, query]);

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
                return inSameDay(base, referenceDate);
            }

            return inSameWeek(base, referenceDate);
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
                <div className="search-top-title">Buscar reservas</div>
            </div>
            {/* Contenido principal de la búsqueda */}
            <div className="search-form-content">
                {userRole !== 'admin' ? (
                    <p className="search-form-empty">Solo administradores pueden ver todas las reservas.</p>
                ) : (
                    <div className="search-form-body">
                        <input
                            className="search-form-search-input"
                            placeholder="Buscar por alumno, email o estado (activa/inactiva)"
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
                                <option value="all">Todas</option>
                                <option value="today">Hoy</option>
                                <option value="week">Semana</option>
                                <option value="month">Mes</option>
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
                                <h4>Selecciona fecha de referencia</h4>
                                <IonDatetime
                                    className="search-form-date-calendar"
                                    presentation="date"
                                    firstDayOfWeek={1}
                                    locale="es-ES"
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
                                        Aplicar
                                    </button>
                                    <button type="button" className="app-btn-danger" onClick={() => setShowPeriodCalendar(false)}>
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </IonModal>

                        {!loading && !error ? (
                            <div className="search-form-summary">
                                <span className="search-form-summary-total">{bookingSummary.total} Reservas</span>
                                <span className="search-form-summary-separator">·</span>
                                <span className="search-form-summary-active">{bookingSummary.active} Activas</span>
                                <span className="search-form-summary-separator">·</span>
                                <span className="search-form-summary-inactive">{bookingSummary.inactive} Canceladas</span>
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="search-form-loading">
                                <IonSpinner name="crescent" color="primary" />
                            </div>
                        ) : error ? (
                            <p className="search-form-error">{error}</p>
                        ) : periodFilteredBookings.length === 0 ? (
                            <p className="search-form-empty">No se encontraron reservas.</p>
                        ) : (
                            <div className="search-form-list">
                                {periodFilteredBookings.map((booking) => {
                                    const statusLabel = mapBookingStatus(booking.status);
                                    const statusClass = booking.status === 'active' ? 'active' : 'inactive';

                                    return (
                                        <div key={booking.id} className="search-form-item">
                                            <div className="search-form-item-name">{booking.user_name || `Alumno #${booking.user_id}`}</div>
                                            <div className="search-form-item-email">{booking.user_email || 'Sin email'}</div>
                                            <div className="search-form-item-meta">
                                                <strong>Estado:</strong> <span className={`search-form-status-badge ${statusClass}`}>{statusLabel}</span>
                                                <span className="search-form-item-meta-separator">·</span>
                                                <strong>Hora:</strong> {formatHour(booking.session_start_time || booking.created_at)}
                                                <span className="search-form-item-meta-separator">·</span>
                                                <strong>Fecha:</strong> {formatDateDdMmYy(booking.session_start_time || booking.created_at)}
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
