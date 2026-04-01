import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import './Tab2.css';

const Tab2: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Añadir</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Añadir</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="tab2-container">
          <p className="tab2-empty">Espacio reservado para futuras acciones de alta.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
