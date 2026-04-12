import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonCard, IonIcon, IonItem, IonLabel, IonModal, IonToggle } from '@ionic/react';
import { App as CapacitorApp } from '@capacitor/app';
import { cameraOutline, moonOutline, personCircleOutline, sunnyOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import logoIcon from '../icons/icon.png';
import editMenuIcon from '../icons/edit.svg';
import helpMenuIcon from '../icons/help.svg';
import normasMenuIcon from '../icons/normas.svg';
import politicaPrivMenuIcon from '../icons/politicaPriv.svg';
import whatsappMenuIcon from '../icons/whatsapp.svg';
import { useAuth } from './AuthContext';
import CustomToast from './CustomStyles';
import { getUserProfile, type UserProfile, updateUserProfile } from '../api/user';
import { getCenterRules, updateCenterRules } from '../api/centerRules';
import { useLanguage } from '../i18n/LanguageContext';
import { getNotificationsEnabled, setNotificationsEnabled as updateNotificationsEnabled } from '../services/fcm';
import { LegalText } from '../utils/legalText';
import './ConfigForm.css';

const DARK_MODE_STORAGE_KEY = 'alesport-dark-mode';
const CENTER_RULES_STORAGE_KEY = 'alesport-center-rules';
const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'verdeguerlabs@verdeguerlabs.es';
const SUPPORT_WHATSAPP_DISPLAY = '+34 633 52 31 26';
const SUPPORT_WHATSAPP_PHONE = '34633523126';
const SUPPORT_WEBSITE = 'https://www.verdeguerlabs.es';
const PHONE_COMPACT_REGEX = /^(?:\+34)?[6789]\d{8}$/;
const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const formatVersionLabel = (version: string, build?: string): string => {
  if (!build || build.trim().length === 0) {
    return version;
  }

  return `${version} (${build})`;
};

/* Función para formatear los dígitos del teléfono en grupos de 3 */
const formatPhoneGroups = (digits: string) => {
  const sanitizedDigits = digits.replace(/\D/g, '').slice(0, 9);
  return sanitizedDigits.replace(/(\d{0,3})(\d{0,3})(\d{0,3}).*/, (_match, a: string, b: string, c: string) =>
    [a, b, c].filter(Boolean).join(' ')
  );
};

/* Función para normalizar el número de teléfono a formato +34 612 345 678 o 612 345 678 */
const normalizePhoneValue = (value: string): string | null => {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (digits.startsWith('34')) {
    if (digits.length !== 11) {
      return null;
    }

    const nationalNumber = digits.slice(2);
    if (!PHONE_COMPACT_REGEX.test(`+34${nationalNumber}`)) {
      return null;
    }

    return `+34 ${formatPhoneGroups(nationalNumber)}`;
  }

  if (digits.length !== 9 || !PHONE_COMPACT_REGEX.test(digits)) {
    return null;
  }

  return formatPhoneGroups(digits);
};

/* Función para formatear el número de teléfono en grupos de 3 dígitos mientras se escribe */
const sanitizePhoneInput = (value: string): string => {
  const cleaned = value.replace(/[^\d+\s]/g, '');
  const trimmed = cleaned.trimStart();
  const digits = cleaned.replace(/\D/g, '');

  if (!digits) {
    return trimmed.startsWith('+') ? '+' : '';
  }

  if (trimmed.startsWith('+') || digits.startsWith('34')) {
    const countryDigits = digits.slice(0, 11);
    if (!countryDigits.startsWith('34')) {
      return `+${countryDigits}`;
    }

    const nationalNumber = countryDigits.slice(2);
    return nationalNumber ? `+34 ${formatPhoneGroups(nationalNumber)}` : '+34';
  }

  return formatPhoneGroups(digits);
};

/* Función para abrir WhatsApp con el número de Alex y un mensaje predefinido */
const handleContactAlex = () => {
  const phone = '34650951666'; // número real de Alex, sin espacios ni +
  const message = encodeURIComponent('Hola Alex, te escribo desde la app de Alesport.');
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
};

const readStoredCenterRules = (): string[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(CENTER_RULES_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalizedRules = parsed
      .map((rule) => (typeof rule === 'string' ? rule.trim() : ''))
      .filter((rule) => rule.length > 0);

    return normalizedRules.length > 0 ? normalizedRules : null;
  } catch {
    return null;
  }
};

const ConfigForm: React.FC = () => {
  const { logout, role } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [editName, setEditName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAvatarSourceAlert, setShowAvatarSourceAlert] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [centerRules, setCenterRules] = useState<string[]>([]);
  const [appVersionLabel, setAppVersionLabel] = useState(() => formatVersionLabel(APP_VERSION));
  const [showRuleEditorModal, setShowRuleEditorModal] = useState(false);
  const [ruleDraft, setRuleDraft] = useState('');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' }>({
    show: false,
    message: '',
    type: 'success',
  });
  const isEnglish = language === 'en';
  const resolvedRole = profile.role ?? role;
  const canShowAlexWhatsapp = resolvedRole === 'client';
  const canShowSupportWhatsapp = !canShowAlexWhatsapp;
  const canManageCenterRules = resolvedRole === 'admin' || resolvedRole === 'superadmin';
  const defaultCenterRules = useMemo(
    () => [
      t('config.centerRule1'),
      t('config.centerRule2'),
      t('config.centerRule3'),
      t('config.centerRule4'),
      t('config.centerRule5'),
    ],
    [t]
  );

  const syncProfileState = (nextProfile: Partial<UserProfile>) => {
    setProfile(nextProfile);
    setEditName(nextProfile.name || '');
    setPhone(nextProfile.phone || '');
    setAvatarPreview(nextProfile.avatar_url || '');
  };

  useEffect(() => {
    let mounted = true;
    getUserProfile(logout || (() => { }))
      .then((data) => {
        if (mounted) {
          syncProfileState(data);
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

  useEffect(() => {
    let cancelled = false;

    void getNotificationsEnabled().then((enabled) => {
      if (!cancelled) {
        setNotifications(enabled);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAppVersion = async () => {
      try {
        const info = await CapacitorApp.getInfo();
        if (!cancelled) {
          setAppVersionLabel(formatVersionLabel(info.version || APP_VERSION, info.build));
        }
      } catch {
        if (!cancelled) {
          setAppVersionLabel(formatVersionLabel(APP_VERSION));
        }
      }
    };

    void loadAppVersion();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadCenterRules = useCallback(async () => {
    const storedRules = readStoredCenterRules();
    const fallbackRules = storedRules ?? defaultCenterRules;

    try {
      const sharedRules = await getCenterRules();
      if (sharedRules.length > 0) {
        setCenterRules(sharedRules);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CENTER_RULES_STORAGE_KEY, JSON.stringify(sharedRules));
        }
        return;
      }

      setCenterRules(fallbackRules);

      if (canManageCenterRules && storedRules && storedRules.length > 0) {
        const syncedRules = await updateCenterRules(storedRules);
        setCenterRules(syncedRules);
        if (typeof window !== 'undefined') {
          localStorage.setItem(CENTER_RULES_STORAGE_KEY, JSON.stringify(syncedRules));
        }
      }
    } catch {
      setCenterRules(fallbackRules);
    }
  }, [canManageCenterRules, defaultCenterRules]);

  useEffect(() => {
    void loadCenterRules();
  }, [loadCenterRules]);

  useEffect(() => {
    if (showRulesModal) {
      void loadCenterRules();
    }
  }, [showRulesModal, loadCenterRules]);

  const openEditProfileModal = () => {
    setEditName(profile.name || '');
    setPhone(profile.phone || '');
    setAvatarPreview(profile.avatar_url || '');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    const trimmedPhone = phone.trim();
    const normalizedPhone = normalizePhoneValue(trimmedPhone);

    if (trimmedName.length < 2) {
      setToast({ show: true, message: t('config.profileNameRequired'), type: 'danger' });
      return;
    }

    if (trimmedPhone && !normalizedPhone) {
      setToast({ show: true, message: t('config.phoneInvalid'), type: 'danger' });
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedProfile = await updateUserProfile({
        name: trimmedName,
        phone: normalizedPhone,
        avatar_url: avatarPreview || null,
      });

      syncProfileState(updatedProfile);
      setShowEditProfileModal(false);
      setToast({ show: true, message: t('config.profileUpdated'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.profileUpdateError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarAutoSave = async (nextAvatar: string | null) => {
    const previousAvatar = profile.avatar_url || '';

    setAvatarPreview(nextAvatar || '');
    setProfile((prev) => ({ ...prev, avatar_url: nextAvatar || null }));
    setIsSavingProfile(true);

    try {
      const updatedProfile = await updateUserProfile({ avatar_url: nextAvatar });
      syncProfileState(updatedProfile);
      setToast({
        show: true,
        message: nextAvatar ? t('config.photoUpdated') : t('config.photoRemovedSuccess'),
        type: 'success',
      });
    } catch (error) {
      setAvatarPreview(previousAvatar);
      setProfile((prev) => ({ ...prev, avatar_url: previousAvatar || null }));
      const message = error instanceof Error ? error.message : t('config.profileUpdateError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
      setIsSavingProfile(false);
    }
  };

  const handleAvatarSelection = async (source: CameraSource) => {
    setShowAvatarSourceAlert(false);

    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source,
        width: 900,
        height: 900,
      });

      if (photo.dataUrl) {
        await handleAvatarAutoSave(photo.dataUrl);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const wasCancelled = message.includes('cancel') || message.includes('canceled') || message.includes('user denied photos');

      if (!wasCancelled) {
        setToast({ show: true, message: t('config.photoAccessError'), type: 'danger' });
      }
    }
  };

  const handleAvatarPicker = () => {
    setShowAvatarSourceAlert(true);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setToast({ show: true, message: t('config.photoInvalidType'), type: 'danger' });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setToast({ show: true, message: t('config.photoTooLarge'), type: 'danger' });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void handleAvatarAutoSave(reader.result);
      }
    };
    reader.onerror = () => {
      setToast({ show: true, message: t('config.photoInvalidType'), type: 'danger' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setShowAvatarSourceAlert(false);
    await handleAvatarAutoSave(null);
  };

  const handleNotificationsChange = async (enabled: boolean) => {
    setIsUpdatingNotifications(true);

    try {
      const nextEnabled = await updateNotificationsEnabled(enabled);
      setNotifications(nextEnabled);

      if (!enabled) {
        setToast({ show: true, message: t('config.notificationsDisabled'), type: 'success' });
      } else if (nextEnabled) {
        setToast({ show: true, message: t('config.notificationsEnabled'), type: 'success' });
      } else {
        setToast({ show: true, message: t('config.notificationsPermissionDenied'), type: 'danger' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.notificationsUpdateError');
      setToast({ show: true, message, type: 'danger' });
      const enabledNow = await getNotificationsEnabled();
      setNotifications(enabledNow);
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleOpenSupportWhatsapp = () => {
    const message = encodeURIComponent('Hola, necesito soporte técnico para Alesport.');
    window.open(`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const persistCenterRules = async (nextRules: string[]) => {
    const previousRules = centerRules;
    setCenterRules(nextRules);

    if (typeof window !== 'undefined') {
      localStorage.setItem(CENTER_RULES_STORAGE_KEY, JSON.stringify(nextRules));
    }

    if (!canManageCenterRules) {
      return nextRules;
    }

    try {
      const syncedRules = await updateCenterRules(nextRules);
      setCenterRules(syncedRules);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CENTER_RULES_STORAGE_KEY, JSON.stringify(syncedRules));
      }
      return syncedRules;
    } catch (error) {
      setCenterRules(previousRules);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CENTER_RULES_STORAGE_KEY, JSON.stringify(previousRules));
      }
      throw error;
    }
  };

  const handleOpenCenterRuleEditor = (indexToEdit?: number) => {
    if (typeof indexToEdit === 'number') {
      setEditingRuleIndex(indexToEdit);
      setRuleDraft(centerRules[indexToEdit] || '');
    } else {
      setEditingRuleIndex(null);
      setRuleDraft('');
    }

    setShowRuleEditorModal(true);
  };

  const handleCloseCenterRuleEditor = () => {
    setShowRuleEditorModal(false);
    setRuleDraft('');
    setEditingRuleIndex(null);
  };

  const handleSaveCenterRule = async () => {
    const trimmedRule = ruleDraft.trim();
    if (trimmedRule.length < 4) {
      setToast({ show: true, message: t('config.centerRuleRequired'), type: 'danger' });
      return;
    }

    try {
      if (editingRuleIndex !== null) {
        const nextRules = centerRules.map((rule, index) => (index === editingRuleIndex ? trimmedRule : rule));
        await persistCenterRules(nextRules);
        setToast({ show: true, message: t('config.centerRuleUpdated'), type: 'success' });
      } else {
        await persistCenterRules([...centerRules, trimmedRule]);
        setToast({ show: true, message: t('config.centerRuleAdded'), type: 'success' });
      }

      handleCloseCenterRuleEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar las normas del centro';
      setToast({ show: true, message, type: 'danger' });
    }
  };

  const handleRemoveCenterRule = async (indexToRemove: number) => {
    const nextRules = centerRules.filter((_, index) => index !== indexToRemove);

    try {
      await persistCenterRules(nextRules);
      setToast({ show: true, message: t('config.centerRuleRemoved'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar las normas del centro';
      setToast({ show: true, message, type: 'danger' });
    }
  };

  const handleOpenSupportEmail = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Soporte Alesport')}`;
  };

  const handleOpenSupportWebsite = () => {
    window.open(SUPPORT_WEBSITE, '_blank', 'noopener,noreferrer');
  };

  const handleLogout = () => {
    if (logout) logout();
    else alert(t('config.loggedOut'));
  };

  return (
    <div className={`config-form-container app-blur-target ${(showEditProfileModal || showSupportModal || showPrivacyModal || showRulesModal || showAvatarSourceAlert || showRuleEditorModal) ? 'app-blur-target--modal-open' : ''}`}>
      <div className="config-top-bar">
        <img src={logoIcon} alt="Logo gimnasio" className="config-top-logo" />
        <div className="config-top-title config-top-title-absolute">{t('config.title')}</div>
      </div>
      <div className="config-form-content">

        <IonCard className="config-profile-card">
          <button
            type="button"
            className="config-profile-avatar-button"
            onClick={handleAvatarPicker}
            aria-label={profile.avatar_url ? t('config.changePhoto') : t('config.addPhoto')}
          >
            <div className="config-profile-avatar">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={t('config.profilePhotoAlt')}
                  className="config-profile-avatar-image"
                />
              ) : (
                <IonIcon icon={personCircleOutline} />
              )}
            </div>
            <span className="config-profile-avatar-badge" aria-hidden="true">
              <IonIcon icon={cameraOutline} />
            </span>
          </button>
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
            <IonToggle
              checked={notifications}
              disabled={isUpdatingNotifications}
              onIonChange={e => { void handleNotificationsChange(e.detail.checked); }}
            />
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
            <img src={editMenuIcon} alt="" className="config-item-icon" slot="start" />
            <IonLabel>{t('config.editProfile')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none" onClick={() => setShowRulesModal(true)}>
            <img src={normasMenuIcon} alt="" className="config-item-icon" slot="start" />
            <IonLabel>{t('config.centerRules')}</IonLabel>
          </IonItem>
          {canShowAlexWhatsapp ? (
            <IonItem button detail={false} lines="none" onClick={handleContactAlex}>
              <img src={whatsappMenuIcon} alt="" className="config-item-icon" slot="start" />
              <IonLabel>{t('config.alexWhatsappButton')}</IonLabel>
            </IonItem>
          ) : null}
          {canShowSupportWhatsapp ? (
            <IonItem button detail={false} lines="none" onClick={handleOpenSupportWhatsapp}>
              <img src={whatsappMenuIcon} alt="" className="config-item-icon" slot="start" />
              <IonLabel>{t('config.supportWhatsappButton')}</IonLabel>
            </IonItem>
          ) : null}
          <IonItem button detail={false} lines="none" onClick={() => setShowPrivacyModal(true)}>
            <img src={politicaPrivMenuIcon} alt="" className="config-item-icon" slot="start" />
            <IonLabel>{t('config.privacyPolicy')}</IonLabel>
          </IonItem>
          <IonItem button detail={false} lines="none" onClick={() => setShowSupportModal(true)}>
            <img src={helpMenuIcon} alt="" className="config-item-icon" slot="start" />
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
        <div className={`config-edit-modal ${showAvatarSourceAlert ? 'app-stacked-modal-dimmed' : ''}`}>
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
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
              maxLength={15}
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

      <IonModal
        className="config-avatar-source-modal-wrapper"
        isOpen={showAvatarSourceAlert}
        showBackdrop={true}
        backdropDismiss={true}
        onDidDismiss={() => setShowAvatarSourceAlert(false)}
      >
        <div className="config-avatar-source-modal">
          <div className="config-avatar-source-modal-header">
            <h3>{t('config.photoSourceTitle')}</h3>
            <p>{t('config.photoSourceMessage')}</p>
          </div>

          <div className="config-avatar-source-modal-actions">
            <button
              type="button"
              className="app-btn-primary config-edit-action-btn config-avatar-source-modal-btn"
              onClick={() => {
                void handleAvatarSelection(CameraSource.Camera);
              }}
              disabled={isSavingProfile}
            >
              {t('config.takePhoto')}
            </button>

            <button
              type="button"
              className="app-btn-primary config-edit-action-btn config-avatar-source-modal-btn"
              onClick={() => {
                void handleAvatarSelection(CameraSource.Photos);
              }}
              disabled={isSavingProfile}
            >
              {t('config.chooseFromGallery')}
            </button>

            {avatarPreview ? (
              <button
                type="button"
                className="app-btn-danger config-edit-action-btn config-avatar-source-modal-btn"
                onClick={() => {
                  void handleRemoveAvatar();
                }}
                disabled={isSavingProfile}
              >
                {t('config.removePhoto')}
              </button>
            ) : null}

          </div>
        </div>
      </IonModal>

      <IonModal
        className="config-edit-modal-wrapper"
        isOpen={showSupportModal}
        onDidDismiss={() => setShowSupportModal(false)}
      >
        <div className="config-edit-modal">
          <div className="config-edit-modal-header">
            <h3>{t('config.helpSupportTitle')}</h3>
            <p>{t('config.helpSupportSubtitle')}</p>
          </div>

          <div className="config-support-stack">
            <div className="config-readonly-card">
              <span className="config-readonly-label">{t('config.versionLabel')}</span>
              <span className="config-readonly-value">Alesport v{appVersionLabel}</span>
            </div>
            <div className="config-readonly-card">
              <span className="config-readonly-label">{t('config.developedByLabel')}</span>
              <span className="config-readonly-value">Verdeguer Labs · 46160 Liria, Valencia</span>
            </div>
            <div className="config-readonly-card">
              <span className="config-readonly-label">{t('config.supportEmailLabel')}</span>
              <span className="config-readonly-value">{SUPPORT_EMAIL}</span>
            </div>
            <div className="config-readonly-card">
              <span className="config-readonly-label">{t('config.websiteLabel')}</span>
              <a
                className="config-support-link"
                href={SUPPORT_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
              >
                www.verdeguerlabs.es
              </a>
            </div>
          </div>

          <div className="config-support-actions">
            <button
              type="button"
              className="app-btn-primary config-edit-action-btn config-support-primary-btn"
              onClick={handleOpenSupportEmail}
            >
              {t('config.contactSupport')}
            </button>
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={() => setShowSupportModal(false)}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </IonModal>

      <IonModal
        className="config-edit-modal-wrapper"
        isOpen={showPrivacyModal}
        onDidDismiss={() => setShowPrivacyModal(false)}
      >
        <div className="config-edit-modal">
          <div className="config-edit-modal-header">
            <h3>{t('config.privacyPolicyTitle')}</h3>
            <p>{t('config.privacyPolicySubtitle')}</p>
          </div>

          <div className="config-legal-scroll">
            <LegalText />
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={() => setShowPrivacyModal(false)}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </IonModal>

      <IonModal
        className="config-edit-modal-wrapper"
        isOpen={showRulesModal}
        onDidDismiss={() => {
          setShowRulesModal(false);
          handleCloseCenterRuleEditor();
        }}
      >
        <div className={`config-edit-modal ${showRuleEditorModal ? 'app-stacked-modal-dimmed' : ''}`}>
          <div className="config-edit-modal-header">
            <h3>{t('config.centerRulesTitle')}</h3>
          </div>
          <div className="config-legal-scroll">
            <p>{t('config.centerRulesIntro')}</p>

            {centerRules.length > 0 ? (
              <ul className="config-rules-list">
                {centerRules.map((rule, index) => (
                  <li key={`${rule}-${index}`} className="config-rules-item">
                    <span className="config-rules-item-text">{rule}</span>
                    {canManageCenterRules ? (
                      <div className="config-rules-item-actions">
                        <button
                          type="button"
                          className="config-rules-edit-btn"
                          onClick={() => handleOpenCenterRuleEditor(index)}
                          aria-label={`${t('config.centerRuleEditButton')} ${index + 1}`}
                        >
                          {t('config.centerRuleEditButton')}
                        </button>
                        <button
                          type="button"
                          className="config-rules-remove-btn"
                          onClick={() => handleRemoveCenterRule(index)}
                          aria-label={`${t('config.centerRuleRemoveButton')} ${index + 1}`}
                        >
                          {t('config.centerRuleRemoveButton')}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="config-rules-empty">{t('config.centerRulesEmpty')}</p>
            )}

            {canManageCenterRules ? (
              <div className="config-rules-editor">
                <button
                  type="button"
                  className="app-btn-primary config-rules-add-btn"
                  onClick={() => handleOpenCenterRuleEditor()}
                >
                  {t('config.centerRuleAddButton')}
                </button>
              </div>
            ) : null}
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={() => setShowRulesModal(false)}
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </IonModal>

      <IonModal
        className="config-edit-modal-wrapper"
        isOpen={showRuleEditorModal}
        onDidDismiss={handleCloseCenterRuleEditor}
      >
        <div className="config-edit-modal">
          <div className="config-edit-modal-header">
            <h3>{editingRuleIndex !== null ? t('config.centerRuleEditTitle') : t('config.centerRuleAddTitle')}</h3>

          </div>

          <div className="config-rules-editor-modal-body">
            <textarea
              className="app-input config-rules-textarea"
              value={ruleDraft}
              onChange={(e) => setRuleDraft(e.target.value)}
              placeholder={t('config.centerRulePlaceholder')}
              maxLength={400}
              rows={7}
            />
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={handleCloseCenterRuleEditor}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="app-btn-primary config-edit-action-btn"
              onClick={handleSaveCenterRule}
            >
              {t('common.save')}
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