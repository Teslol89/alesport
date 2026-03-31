
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import LogoutButton from '../components/LogoutButton';
import './Tab3.css';

const Tab3: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Tab 3</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Tab 3</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2rem' }}>
          {/* Aquí puedes añadir contenido personalizado para Tab 3 */}
          <LogoutButton />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab3;
