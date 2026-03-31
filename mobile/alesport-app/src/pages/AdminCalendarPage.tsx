/* Page para el calendario del admin, con filtros, barra superior, etc. */
import { IonContent, IonPage } from '@ionic/react';

import './AdminCalendarPage.css';
import Calendar from '../components/Calendar';


const AdminCalendarPage: React.FC = () => {
    return (
        <IonPage className="admin-calendar-page">
            <IonContent fullscreen>
                {/* Aquí irán filtros, barra superior, etc. */}
                <Calendar />
            </IonContent>
        </IonPage>
    );
};

export default AdminCalendarPage;
