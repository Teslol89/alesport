import React, { useState, useEffect } from 'react';
import { IonIcon, IonCard, IonItem, IonLabel, IonToggle } from '@ionic/react';
import { logOutOutline, notificationsOutline, calendarOutline, settingsOutline, helpCircleOutline, personCircleOutline, pencilOutline, sunnyOutline, moonOutline } from 'ionicons/icons';
import logoIcon from '../icons/icon.png';
import { useAuth } from './AuthContext';
import { getUserProfile } from '../api/user';
import { useLanguage } from '../i18n/LanguageContext';
import './ConfigForm.css';

const DARK_MODE_STORAGE_KEY = 'alesport-dark-mode';

const ConfigForm: React.FC = () => {
  const { logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<{ name?: string; email?: string }>({});
  const [name, setName] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true');
  const [notifications, setNotifications] = useState(true);
  const isEnglish = language === 'en';

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
    else alert(t('config.loggedOut'));
  };

  return (
    <div className="config-form-container">
      <div className="config-top-bar">
        <img src={logoIcon} alt="Logo gimnasio" className="config-top-logo" />
        <div className="config-top-title config-top-title-absolute">{t('config.title')}</div>
      </div>
      <div className="config-form-content">

        {/* Tarjeta de perfil grande */}
        <IonCard className="config-profile-card">
          <div className="config-profile-avatar">
            <IonIcon icon={personCircleOutline} />
          </div>
          <div className="config-profile-name">{profile.name || t('config.nameFallback')}</div>
          <div className="config-profile-email">{profile.email || t('config.emailFallback')}</div>
        </IonCard>

        {/* Preferencias */}
        <IonCard className="config-card">
          <IonItem>
            <IonLabel>{t('config.darkMode')}</IonLabel>
            <IonToggle checked={darkMode} disabled onIonChange={e => setDarkMode(e.detail.checked)}>
              <IonIcon slot="start" icon={sunnyOutline} />
              <IonIcon slot="end" icon={moonOutline} />
            </IonToggle>
          </IonItem>
          <IonItem>
            <IonLabel>{t('config.notifications')}</IonLabel>
            <IonToggle checked={notifications} onIonChange={e => setNotifications(e.detail.checked)} />
          </IonItem>
          <IonItem>
            <IonLabel>{t('config.language')}</IonLabel>
            <div className="config-language-switch">
              <span className={`config-language-option ${!isEnglish ? 'active' : ''}`}>ES</span>
              <IonToggle
                checked={isEnglish}
                onIonChange={e => setLanguage(e.detail.checked ? 'en' : 'es')}
                aria-label={t('config.languageToggleAria')}
              />
              <span className={`config-language-option ${isEnglish ? 'active' : ''}`}>EN</span>
            </div>
          </IonItem>
        </IonCard>

        {/* Lista de opciones extra estilo moderno */}
        <IonCard className="config-card">
          <IonItem button detail={false} lines="none">
            <IonIcon icon={pencilOutline} slot="start" />
            <IonLabel>{t('config.editProfile')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none">
            <IonIcon icon={notificationsOutline} slot="start" />
            <IonLabel>{t('config.notifications')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none">
            <IonIcon icon={calendarOutline} slot="start" />
            <IonLabel>{t('config.calendarSettings')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none">
            <IonIcon icon={settingsOutline} slot="start" />
            <IonLabel>{t('config.settings')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none">
            <IonIcon icon={helpCircleOutline} slot="start" />
            <IonLabel>{t('config.help')}</IonLabel>
          </IonItem>
        </IonCard>

        {/* Botón logout */}
        <div className="config-logout">
          <button type="button" className="app-btn-danger config-logout-btn" onClick={handleLogout}>
            <span>{t('config.logout')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigForm;