import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import Calendar from '../components/Calendar';

const AdminCalendarPage: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Panel de Agenda</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {/* Aquí irán filtros, barra superior, etc. */}
        <Calendar />
      </IonContent>
    </IonPage>
  );
};

export default AdminCalendarPage;
