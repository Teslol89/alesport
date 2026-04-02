import { IonContent, IonHeader, IonPage } from '@ionic/react';
import CrearForm from '../components/CrearForm';
import './Crear.css';

const Crear: React.FC = () => {
  return (
    <IonPage className="crear-page">
      <IonHeader />
      <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
        <div className="crear-center-wrapper">
          <CrearForm />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Crear;
