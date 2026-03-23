import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import ExploreContainer from '../components/ExploreContainer';
import LogoutButton from '../components/LogoutButton';
import { useAuth } from '../components/AuthContext';
import { useEffect, useState } from 'react';
import { getUserProfile } from '../api/user';
import './Tab1.css';

const Tab1: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getUserProfile(logout)
        .then(setUser)
        .catch(err => {
          if (err.message !== 'UNAUTHORIZED') setError('Error al cargar usuario');
        });
    }
  }, [isAuthenticated, logout]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Tab 1</IonTitle>
          {isAuthenticated && <LogoutButton />}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Tab 1</IonTitle>
          </IonToolbar>
        </IonHeader>
        {user && <div>Bienvenido, {user.email}</div>}
        {error && <div>{error}</div>}
        <ExploreContainer name="Tab 1" />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;
