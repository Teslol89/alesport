import { IonContent, IonHeader, IonPage } from '@ionic/react';
import BuscarForm from '../components/BuscarForm';
import './Buscar.css';

const TabSearch: React.FC = () => {
  return (
    <IonPage className="search-page">
      <IonHeader />
      <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
        <div className="search-center-wrapper">
          <BuscarForm />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TabSearch;
