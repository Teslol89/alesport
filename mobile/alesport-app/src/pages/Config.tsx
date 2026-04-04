import { IonContent, IonHeader, IonPage } from '@ionic/react';
import LogoutButton from '../components/LogoutButton';
import './Config.css';

const Config: React.FC = () => {
  return (
    <IonPage className="search-page">
      <IonHeader />
      <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
        <div className="config-center-wrapper">
          <LogoutButton />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Config;
