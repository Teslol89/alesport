import React, { useState, useEffect } from 'react';
import { IonButton, IonIcon, IonCard, IonList, IonItem, IonLabel, IonInput, IonToggle } from '@ionic/react';
import { logOutOutline, notificationsOutline, calendarOutline, settingsOutline, helpCircleOutline, personCircleOutline, pencilOutline, sunnyOutline, moonOutline } from 'ionicons/icons';
import logoIcon from '../icons/icon.png';
import { useAuth } from './AuthContext';
import { getUserProfile } from '../api/user';
import './ConfigForm.css';

const DARK_MODE_STORAGE_KEY = 'alesport-dark-mode';

const ConfigForm: React.FC = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<{ name?: string; email?: string }>({});
  const [name, setName] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true');
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

  useEffect(() => {
    const ionApp = document.querySelector('ion-app');
    document.body.classList.toggle('ion-palette-dark', darkMode);
    document.documentElement.classList.toggle('ion-palette-dark', darkMode);
    ionApp?.classList.toggle('ion-palette-dark', darkMode);
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(darkMode));
  }, [darkMode]);

  const handleLogout = () => {
    if (logout) logout();
    else alert('Sesión cerrada');
  };

  return (
    <div className="config-form-container">
      <div className="config-top-bar">
        <img src={logoIcon} alt="Logo gimnasio" className="config-top-logo" />
        <div className="config-top-title config-top-title-absolute">Configuración</div>
      </div>
      <div className="config-form-content">

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
          <IonItem>
            <IonLabel position="stacked">Nombre</IonLabel>
            <IonInput value={name} onIonChange={e => setName(e.detail.value ?? '')} />
          </IonItem>
        </IonCard>

        {/* Preferencias */}
        <IonCard className="config-card">
          <IonItem>
            <IonLabel>Modo oscuro</IonLabel>
            <IonToggle checked={darkMode} disabled onIonChange={e => setDarkMode(e.detail.checked)}>
              <IonIcon slot="start" icon={sunnyOutline} />
              <IonIcon slot="end" icon={moonOutline} />
            </IonToggle>
          </IonItem>
          <IonItem>
            <IonLabel>Notificaciones</IonLabel>
            <IonToggle checked={notifications} onIonChange={e => setNotifications(e.detail.checked)} />
          </IonItem>
        </IonCard>

        {/* Lista de opciones extra estilo moderno */}
        <IonCard className="config-card">
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
        </IonCard>

        {/* Botón logout */}
        <div className="config-logout-row">
          <IonButton expand="block" fill="clear" className="config-logout-btn" onClick={handleLogout}>
            <IonIcon slot="start" icon={logOutOutline} />
            <span>Cerrar sesión</span>
          </IonButton>
        </div>
      </div>
    </div>
  );
};

export default ConfigForm;