import { useEffect, useMemo, useState } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonSpinner } from '@ionic/react';
import { BookingItem, getAllBookings } from '../api/bookings';
import { getUserProfile } from '../api/user';
import './Tab2.css';

const TabSearch: React.FC = () => {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    getUserProfile(() => {})
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
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Buscar reservas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Buscar reservas</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="tab2-container">
          {userRole !== 'admin' ? (
            <p className="tab2-empty">Solo administradores pueden ver todas las reservas.</p>
          ) : (
            <>
              <input
                className="tab2-search-input"
                placeholder="Buscar por alumno, email, user_id o session_id"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              {loading ? (
                <div className="tab2-loading">
                  <IonSpinner name="crescent" color="primary" />
                </div>
              ) : error ? (
                <p className="tab2-error">{error}</p>
              ) : filteredBookings.length === 0 ? (
                <p className="tab2-empty">No se encontraron reservas.</p>
              ) : (
                <div className="tab2-list">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="tab2-item">
                      <div className="tab2-item-name">{booking.user_name || `Alumno #${booking.user_id}`}</div>
                      <div className="tab2-item-email">{booking.user_email || 'Sin email'}</div>
                      <div className="tab2-item-meta">
                        Reserva #{booking.id} · Sesión #{booking.session_id} · Estado: {booking.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TabSearch;
