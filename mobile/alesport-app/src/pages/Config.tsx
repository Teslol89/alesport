import { IonContent, IonHeader, IonPage } from '@ionic/react';
import ConfigForm from '../components/ConfigForm';
import './Config.css';

const Config: React.FC = () => {
  return (
    <IonPage className="search-page">
      <IonHeader />
      <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
        <div className="config-center-wrapper">
          <ConfigForm />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Config;
