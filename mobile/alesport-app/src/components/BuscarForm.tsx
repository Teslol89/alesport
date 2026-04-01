import { useEffect, useMemo, useState } from 'react';
import { IonSpinner } from '@ionic/react';
import { BookingItem, getAllBookings } from '../api/bookings';
import { getUserProfile } from '../api/user';
import './BuscarForm.css';

const BuscarForm: React.FC = () => {
    const [bookings, setBookings] = useState<BookingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
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
            const byUserId = String(b.user_id).includes(q);
            const bySessionId = String(b.session_id).includes(q);
            return byName || byEmail || byUserId || bySessionId;
        });
    }, [bookings, query]);

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
                            placeholder="Buscar por alumno, email, user_id o session_id"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />

                        {loading ? (
                            <div className="search-form-loading">
                                <IonSpinner name="crescent" color="primary" />
                            </div>
                        ) : error ? (
                            <p className="search-form-error">{error}</p>
                        ) : filteredBookings.length === 0 ? (
                            <p className="search-form-empty">No se encontraron reservas.</p>
                        ) : (
                            <div className="search-form-list">
                                {filteredBookings.map((booking) => (
                                    <div key={booking.id} className="search-form-item">
                                        <div className="search-form-item-name">{booking.user_name || `Alumno #${booking.user_id}`}</div>
                                        <div className="search-form-item-email">{booking.user_email || 'Sin email'}</div>
                                        <div className="search-form-item-meta">
                                            Reserva #{booking.id} · Sesión #{booking.session_id} · Estado: {booking.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuscarForm;
