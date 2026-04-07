import React, { useEffect, useState } from 'react';
import { IonCard, IonIcon, IonItem, IonLabel, IonModal, IonToggle } from '@ionic/react';
import { calendarOutline, helpCircleOutline, moonOutline, notificationsOutline, pencilOutline, personCircleOutline, settingsOutline, sunnyOutline } from 'ionicons/icons';
import logoIcon from '../icons/icon.png';
import { useAuth } from './AuthContext';
import CustomToast from './CustomStyles';
import { getUserProfile, type UserProfile, updateUserProfile } from '../api/user';
import { useLanguage } from '../i18n/LanguageContext';
import './ConfigForm.css';

const DARK_MODE_STORAGE_KEY = 'alesport-dark-mode';

const ConfigForm: React.FC = () => {
  const { logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [editName, setEditName] = useState('');
  const [phone, setPhone] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true');
  const [notifications, setNotifications] = useState(true);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const isEnglish = language === 'en';

  useEffect(() => {
    let mounted = true;
    getUserProfile(logout || (() => { }))
      .then((data) => {
        if (mounted) {
          setProfile(data);
          setEditName(data.name || '');
          setPhone(data.phone || '');
        }
      })
      .catch(() => { });

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

  const openEditProfileModal = () => {
    setEditName(profile.name || '');
    setPhone(profile.phone || '');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedPhone = phone.trim();

    if (trimmedName.length < 2) {
      setToast({ show: true, message: t('config.profileNameRequired'), type: 'danger' });
      return;
    }

    if (trimmedPhone.length > 20) {
      setToast({ show: true, message: t('config.phoneTooLong'), type: 'danger' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedProfile = await updateUserProfile({
        name: trimmedName,
        phone: trimmedPhone || null,
      });

      setProfile(updatedProfile);
      setEditName(updatedProfile.name || '');
      setPhone(updatedProfile.phone || '');
      setShowEditProfileModal(false);
      setToast({ show: true, message: t('config.profileUpdated'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.profileUpdateError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      setIsSavingProfile(false);
    }
  };

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

        <IonCard className="config-profile-card">
          <div className="config-profile-avatar">
            <IonIcon icon={personCircleOutline} />
          </div>
          <div className="config-profile-name">{profile.name || t('config.nameFallback')}</div>
          <div className="config-profile-email">{profile.email || t('config.emailFallback')}</div>
          {profile.phone ? <div className="config-profile-phone">{profile.phone}</div> : null}
        </IonCard>

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

        <IonCard className="config-card">
          <IonItem button detail={false} lines="none" onClick={openEditProfileModal}>
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

        <div className="config-logout">
          <button type="button" className="app-btn-danger config-logout-btn" onClick={handleLogout}>
            <span>{t('config.logout')}</span>
          </button>
        </div>
      </div>

      <IonModal
        className="config-edit-modal-wrapper"
        isOpen={showEditProfileModal}
        onDidDismiss={() => setShowEditProfileModal(false)}
      >
        <div className="config-edit-modal">
          <div className="config-edit-modal-header">
            <h3>{t('config.editProfileTitle')}</h3>
            <p>{t('config.editProfileSubtitle')}</p>
          </div>

          <div className="config-edit-form">
            <label className="config-field-label" htmlFor="config-edit-name">{t('config.fullName')}</label>
            <input
              id="config-edit-name"
              className="app-input config-edit-input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
            />

            <label className="config-field-label" htmlFor="config-edit-phone">{t('config.phone')}</label>
            <input
              id="config-edit-phone"
              className="app-input config-edit-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder={t('config.phonePlaceholder')}
            />

            <div className="config-readonly-grid">
              <div className="config-readonly-card">
                <span className="config-readonly-label">{t('config.emailLabel')}</span>
                <span className="config-readonly-value">{profile.email || t('config.emailFallback')}</span>
              </div>
              <div className="config-readonly-card">
                <span className="config-readonly-label">{t('config.membershipLabel')}</span>
                <span className={`config-membership-badge ${profile.membership_active ? 'active' : 'inactive'}`}>
                  {profile.membership_active ? t('config.membershipActive') : t('config.membershipInactive')}
                </span>
              </div>
            </div>
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={() => setShowEditProfileModal(false)}
              disabled={isSavingProfile}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="app-btn-primary config-edit-action-btn"
              onClick={handleSaveProfile}
              disabled={isSavingProfile}
            >
              {isSavingProfile ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </IonModal>

      <CustomToast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
        type={toast.type}
        duration={2600}
      />
    </div>
  );
};

export default ConfigForm;