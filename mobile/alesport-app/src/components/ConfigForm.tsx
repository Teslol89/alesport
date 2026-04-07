import React, { useState, useEffect } from 'react';
import { IonPage, IonContent, IonButton, IonIcon, IonCard, IonList, IonItem, IonLabel, IonInput, IonToggle, IonAvatar } from '@ionic/react';
import { logOutOutline, notificationsOutline, calendarOutline, settingsOutline, helpCircleOutline, personCircleOutline, pencilOutline, sunnyOutline, moonOutline } from 'ionicons/icons';
import { useAuth } from './AuthContext';
import { getUserProfile } from '../api/user';
import './ConfigForm.css';

const ConfigForm: React.FC = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<{ name?: string; email?: string }>({});
  const [name, setName] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const stats = [
    { value: 24, label: 'Eventos', color: '#2563eb' },
    { value: 12, label: 'Tareas', color: '#16a34a' },
    { value: 8, label: 'Reuniones', color: '#a21caf' },
  ];

  useEffect(() => {
    let mounted = true;
    getUserProfile(logout || (() => { })).then((data) => {
      if (mounted) {
        setProfile(data);
        setName(data.name || '');
      }
    }).catch(() => { });
    return () => { mounted = false; };
  }, [logout]);

  const handleLogout = () => {
    if (logout) logout();
    else alert('Sesión cerrada');
  };

  return (
    <IonPage className="config-modern-bg">
      <IonContent className="config-modern-content">
        {/* Tarjeta de perfil grande */}
        <IonCard className="config-profile-card">
          <div className="config-profile-avatar">
            <IonIcon icon={personCircleOutline} />
          </div>
          <div className="config-profile-name">{profile.name || 'John Doe'}</div>
          <div className="config-profile-email">{profile.email || 'john.doe@example.com'}</div>
        </IonCard>

        {/* Sección de edición de perfil */}
        <IonCard className="config-card">
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Nombre</IonLabel>
              <IonInput value={name} onIonChange={e => setName(e.detail.value ?? '')} />
            </IonItem>
          </IonList>
        </IonCard>

        {/* Preferencias */}
        <IonCard className="config-card">
          <IonList>
            <IonItem>
              <IonLabel>Modo oscuro</IonLabel>
              <IonToggle checked={darkMode} onIonChange={e => setDarkMode(e.detail.checked)}>
                <IonIcon slot="start" icon={sunnyOutline} />
                <IonIcon slot="end" icon={moonOutline} />
              </IonToggle>
            </IonItem>
            <IonItem>
              <IonLabel>Notificaciones</IonLabel>
              <IonToggle checked={notifications} onIonChange={e => setNotifications(e.detail.checked)} />
            </IonItem>
          </IonList>
        </IonCard>

        {/* Lista de opciones extra estilo moderno */}
        <IonCard className="config-card">
          <IonList>
            <IonItem button detail={false} lines="none">
              <IonIcon icon={pencilOutline} slot="start" />
              <IonLabel>Editar perfil</IonLabel>
            </IonItem>
            <IonItem button detail={false} lines="none">
              <IonIcon icon={notificationsOutline} slot="start" />
              <IonLabel>Notificaciones</IonLabel>
            </IonItem>
            <IonItem button detail={false} lines="none">
              <IonIcon icon={calendarOutline} slot="start" />
              <IonLabel>Ajustes de calendario</IonLabel>
            </IonItem>
            <IonItem button detail={false} lines="none">
              <IonIcon icon={settingsOutline} slot="start" />
              <IonLabel>Configuración</IonLabel>
            </IonItem>
            <IonItem button detail={false} lines="none">
              <IonIcon icon={helpCircleOutline} slot="start" />
              <IonLabel>Ayuda y soporte</IonLabel>
            </IonItem>
          </IonList>
        </IonCard>

        {/* Botón logout */}
        <div className="config-logout-row">
          <IonButton expand="block" fill="clear" className="config-logout-btn" onClick={handleLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            <span>Cerrar sesión</span>
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ConfigForm;