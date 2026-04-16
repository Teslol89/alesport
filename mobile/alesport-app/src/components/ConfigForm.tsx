import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IonCard, IonIcon, IonItem, IonLabel, IonModal, IonToggle } from '@ionic/react';
import { App as CapacitorApp } from '@capacitor/app';
import { cameraOutline, moonOutline, personCircleOutline, sunnyOutline } from 'ionicons/icons';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import logoIcon from '../icons/icon.png';
import editMenuIcon from '../icons/edit.svg';
import normasMenuIcon from '../icons/normas.svg';
import helpMenuIcon from '../icons/help.svg';
import payMenuIcon from '../icons/pagar.svg';
import politicaPrivMenuIcon from '../icons/politicaPriv.svg';
import whatsappMenuIcon from '../icons/whatsapp.svg';
import { useAuth } from './AuthContext';
import CustomToast from './CustomStyles';
import { getUserProfile, getUsersForAdmin, type UserProfile, updateUserAdminSettings, updateUserProfile, deleteMyAccount } from '../api/user';
import { getAllBookings, type BookingItem } from '../api/bookings';
import { getRealtimeWsTicket } from '../api/realtime';
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
const CLIENT_PLAN_OPTIONS: Array<{ value: number | 'custom' | 'none'; label: string }> = [
  { value: 'none', label: 'Sin Plan' },
  { value: 8, label: 'Plan 8 clases' },
  { value: 12, label: 'Plan 12 clases' },
  { value: 'custom', label: 'Personalizado' },
];
const FIXED_PLAN_VALUES = [8, 12];

const PICKER_ITEM_HEIGHT = 44;
const PICKER_VALUES = Array.from({ length: 60 }, (_, i) => i + 1);
const CLIENT_PLANS_AUTO_REFRESH_MS = 10000;
const CLIENT_PLANS_REALTIME_COOLDOWN_MS = 700;
const CLIENT_PLANS_REFRESH_PAUSE_AFTER_MUTATION_MS = 1400;

type ClientUsageSummary = {
  used: number;
  remaining: number | null;
};

/* Función para formatear la etiqueta de versión, incluyendo el número de build si está disponible */
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

/* Función para leer las reglas del centro desde el almacenamiento local, con validación y normalización */
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

/* Función para convertir una cadena de texto en un número entero, con validación y manejo de casos especiales */
const asDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/* Función para determinar si una fecha dada está dentro del mes actual, comparando año y mes con la fecha actual */
const isDateInsideCurrentMonth = (date: Date): boolean => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

/* Función para construir un mapa de uso de clases por cliente, contando las reservas activas del mes actual y comparándolas con la cuota mensual */
const buildClientUsageMap = (clients: UserProfile[], bookings: BookingItem[]): Record<number, ClientUsageSummary> => {
  const activeBookingsThisMonth = bookings.filter((booking) => {
    if (booking.status !== 'active') {
      return false;
    }

    const sessionDate = asDate(booking.session_start_time ?? booking.created_at);
    return sessionDate ? isDateInsideCurrentMonth(sessionDate) : false;
  });

  const usageByClientId: Record<number, number> = {};
  activeBookingsThisMonth.forEach((booking) => {
    usageByClientId[booking.user_id] = (usageByClientId[booking.user_id] ?? 0) + 1;
  });

  const usageMap: Record<number, ClientUsageSummary> = {};
  clients.forEach((client) => {
    const used = usageByClientId[client.id] ?? 0;
    const quota = client.monthly_booking_quota ?? null;
    usageMap[client.id] = {
      used,
      remaining: quota === null ? null : Math.max(quota - used, 0),
    };
  });

  return usageMap;
};

/* ConfigForm es el componente principal para la pantalla de configuración,
donde los usuarios pueden editar su perfil, cambiar idioma, gestionar reglas del centro
y planes de clientes (si tienen permisos), etc. */
const ConfigForm: React.FC = () => {
  const { logout, role, user } = useAuth();
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
  const [showClientPlansModal, setShowClientPlansModal] = useState(false);
  const [managedClients, setManagedClients] = useState<UserProfile[]>([]);
  const [clientPlansSearch, setClientPlansSearch] = useState('');
  const [clientUsageMap, setClientUsageMap] = useState<Record<number, ClientUsageSummary>>({});
  const [isLoadingManagedClients, setIsLoadingManagedClients] = useState(false);
  const [isRefreshingManagedClients, setIsRefreshingManagedClients] = useState(false);
  const [savingClientId, setSavingClientId] = useState<number | null>(null);
  const [customQuotaTarget, setCustomQuotaTarget] = useState<{ userId: number; name: string } | null>(null);
  const [customQuotaDraft, setCustomQuotaDraft] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const clientPlansRealtimeSocketRef = useRef<WebSocket | null>(null);
  const clientPlansRealtimeReconnectTimerRef = useRef<number | null>(null);
  const clientPlansRealtimeRefreshAtRef = useRef(0);
  const clientPlansMutationAtRef = useRef(0);
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
  const canManageClientPlans = canManageCenterRules;
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

  const filteredManagedClients = useMemo(() => {
    const term = clientPlansSearch.trim().toLowerCase();
    if (!term) {
      return managedClients;
    }

    return managedClients.filter((clientUser) => {
      const name = (clientUser.name || '').toLowerCase();
      const email = (clientUser.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [managedClients, clientPlansSearch]);

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
    if (!user) {
      return;
    }

    setProfile((prevProfile) => ({ ...prevProfile, ...user }));
  }, [user]);

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

  const loadManagedClients = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!canManageClientPlans) {
      return;
    }

    if (mode === 'initial') {
      setIsLoadingManagedClients(true);
    } else {
      setIsRefreshingManagedClients(true);
    }

    try {
      const [users, bookings] = await Promise.all([getUsersForAdmin(), getAllBookings()]);
      const clients = users
        .filter((user) => user.role === 'client')
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

      setManagedClients(clients);
      setClientUsageMap(buildClientUsageMap(clients, bookings));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.clientPlansLoadError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      if (mode === 'initial') {
        setIsLoadingManagedClients(false);
      } else {
        setIsRefreshingManagedClients(false);
      }
    }
  }, [canManageClientPlans, t]);

  useEffect(() => {
    if (canManageClientPlans && managedClients.length === 0) {
      void loadManagedClients();
    }
  }, [canManageClientPlans, loadManagedClients, managedClients.length]);

  // When modal opens, data is already loaded (no spinner on first open)
  useEffect(() => {
    if (showClientPlansModal && managedClients.length === 0 && !isLoadingManagedClients) {
      void loadManagedClients();
    }
  }, [showClientPlansModal, loadManagedClients, managedClients.length, isLoadingManagedClients]);

  useEffect(() => {
    if (!showClientPlansModal || !canManageClientPlans) {
      return;
    }

    const shouldSkipBackgroundRefresh = () => {
      if (savingClientId !== null || isLoadingManagedClients || isRefreshingManagedClients) {
        return true;
      }

      const elapsedSinceMutation = Date.now() - clientPlansMutationAtRef.current;
      return elapsedSinceMutation < CLIENT_PLANS_REFRESH_PAUSE_AFTER_MUTATION_MS;
    };

    const refreshClientPlansState = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (shouldSkipBackgroundRefresh()) {
        return;
      }

      void loadManagedClients('refresh');
    };

    const intervalId = window.setInterval(refreshClientPlansState, CLIENT_PLANS_AUTO_REFRESH_MS);
    window.addEventListener('focus', refreshClientPlansState);
    document.addEventListener('visibilitychange', refreshClientPlansState);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshClientPlansState);
      document.removeEventListener('visibilitychange', refreshClientPlansState);
    };
  }, [
    canManageClientPlans,
    isLoadingManagedClients,
    isRefreshingManagedClients,
    loadManagedClients,
    savingClientId,
    showClientPlansModal,
  ]);

  useEffect(() => {
    if (!showClientPlansModal || !canManageClientPlans) {
      return;
    }

    let cancelled = false;

    const buildWsUrl = (ticket: string) => {
      const base = import.meta.env.VITE_API_BASE_URL || 'https://api.verdeguerlabs.es/api';
      const wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      return `${wsBase}/realtime/ws?ticket=${encodeURIComponent(ticket)}`;
    };

    const closeSocket = () => {
      if (clientPlansRealtimeSocketRef.current) {
        clientPlansRealtimeSocketRef.current.close();
        clientPlansRealtimeSocketRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || clientPlansRealtimeReconnectTimerRef.current !== null) {
        return;
      }
      clientPlansRealtimeReconnectTimerRef.current = window.setTimeout(() => {
        clientPlansRealtimeReconnectTimerRef.current = null;
        void connect();
      }, 2500);
    };

    const triggerRealtimeRefresh = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (savingClientId !== null || isLoadingManagedClients || isRefreshingManagedClients) {
        return;
      }

      const elapsedSinceMutation = Date.now() - clientPlansMutationAtRef.current;
      if (elapsedSinceMutation < CLIENT_PLANS_REFRESH_PAUSE_AFTER_MUTATION_MS) {
        return;
      }

      const now = Date.now();
      if (now - clientPlansRealtimeRefreshAtRef.current < CLIENT_PLANS_REALTIME_COOLDOWN_MS) {
        return;
      }

      clientPlansRealtimeRefreshAtRef.current = now;
      void loadManagedClients('refresh');
    };

    const connect = async () => {
      if (cancelled) {
        return;
      }

      closeSocket();

      try {
        const wsTicket = await getRealtimeWsTicket();
        if (cancelled) {
          return;
        }

        const socket = new WebSocket(buildWsUrl(wsTicket));
        clientPlansRealtimeSocketRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string };
            if (payload.type === 'booking_changed') {
              triggerRealtimeRefresh();
            }
          } catch {
            // Ignorar mensajes no JSON.
          }
        };

        socket.onerror = () => {
          closeSocket();
          scheduleReconnect();
        };

        socket.onclose = () => {
          closeSocket();
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      closeSocket();
      if (clientPlansRealtimeReconnectTimerRef.current !== null) {
        window.clearTimeout(clientPlansRealtimeReconnectTimerRef.current);
        clientPlansRealtimeReconnectTimerRef.current = null;
      }
    };
  }, [canManageClientPlans, loadManagedClients, showClientPlansModal]);

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

  const handleOpenCustomQuota = (userId: number, name: string, currentQuota: number | null | undefined) => {
    const isAlreadyCustom = currentQuota !== null && currentQuota !== undefined && !FIXED_PLAN_VALUES.includes(currentQuota);
    setCustomQuotaDraft(isAlreadyCustom ? String(currentQuota) : '8');
    setCustomQuotaTarget({ userId, name });
  };

  useEffect(() => {
    if (!customQuotaTarget || !pickerRef.current) {
      return;
    }
    const val = parseInt(customQuotaDraft, 10);
    const idx = Number.isFinite(val) && val >= 1 && val <= 60 ? val - 1 : 7;
    pickerRef.current.scrollTop = idx * PICKER_ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customQuotaTarget]);

  const handlePickerScroll = () => {
    if (!pickerRef.current) {
      return;
    }
    const idx = Math.round(pickerRef.current.scrollTop / PICKER_ITEM_HEIGHT);
    setCustomQuotaDraft(String(Math.min(60, Math.max(1, idx + 1))));
  };

  const handleConfirmCustomQuota = async () => {
    if (!customQuotaTarget) {
      return;
    }

    const parsed = parseInt(customQuotaDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 60) {
      setToast({ show: true, message: t('config.clientPlansCustomQuotaInvalid'), type: 'danger' });
      return;
    }

    const { userId } = customQuotaTarget;
    setCustomQuotaTarget(null);
    setCustomQuotaDraft('');
    await handlePatchClient(userId, { monthly_booking_quota: parsed });
  };

  const handlePatchClient = async (userId: number, payload: { is_active?: boolean; membership_active?: boolean; monthly_booking_quota?: number | null; }) => {
    setSavingClientId(userId);
    try {
      const updatedUser = await updateUserAdminSettings(userId, payload);
      setManagedClients((prev) => {
        const nextUsers = prev.map((user) => (user.id === userId ? updatedUser : user));
        setClientUsageMap((prevUsage) => {
          const used = prevUsage[userId]?.used ?? 0;
          const quota = updatedUser.monthly_booking_quota ?? null;
          return {
            ...prevUsage,
            [userId]: {
              used,
              remaining: quota === null ? null : Math.max(quota - used, 0),
            },
          };
        });
        return nextUsers;
      });
      clientPlansMutationAtRef.current = Date.now();
      if (profile.id === updatedUser.id) {
        syncProfileState(updatedUser);
      }
      setToast({ show: true, message: t('config.clientPlansSaved'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('config.clientPlansSaveError');
      setToast({ show: true, message, type: 'danger' });
    } finally {
      setSavingClientId(null);
    }
  };

  const handleLogout = () => {
    if (logout) logout();
    else alert(t('config.loggedOut'));
  };

  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      await deleteMyAccount();
      if (logout) logout();
    } catch {
      setToast({ show: true, message: t('config.deleteAccountError'), type: 'danger' });
    }
  };

  return (
    <div className={`config-form-container app-blur-target ${(showEditProfileModal || showSupportModal || showPrivacyModal || showRulesModal || showAvatarSourceAlert || showRuleEditorModal || showClientPlansModal || showDeleteAccountConfirm) ? 'app-blur-target--modal-open' : ''}`}>
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
          {canManageClientPlans ? (
            <IonItem button detail={false} lines="none" onClick={() => setShowClientPlansModal(true)}>
              <img src={payMenuIcon} alt="" className="config-item-icon" slot="start" />
              <IonLabel>{t('config.clientPlansTitle')}</IonLabel>
            </IonItem>
          ) : null}
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
          <button type="button" className="config-delete-account-btn" onClick={() => setShowDeleteAccountConfirm(true)}>
            <span>{t('config.deleteAccount')}</span>
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
        className="config-edit-modal-wrapper"
        isOpen={showClientPlansModal}
        onDidDismiss={() => setShowClientPlansModal(false)}
      >
        <div className="config-edit-modal" style={{ position: 'relative' }}>
          {customQuotaTarget ? (
            <div className="config-custom-quota-overlay" role="dialog" aria-modal="true">
              <div className="config-custom-quota-modal">
                <h4 className="config-custom-quota-title">{t('config.clientPlansCustomQuotaTitle')}</h4>
                <p className="config-custom-quota-subtitle">{customQuotaTarget.name}</p>
                <div className="config-quota-picker-wrapper">
                  <div className="config-quota-picker-highlight" aria-hidden="true" />
                  <div
                    className="config-quota-picker-scroll"
                    ref={pickerRef}
                    onScroll={handlePickerScroll}
                  >
                    {PICKER_VALUES.map((n) => (
                      <div
                        key={n}
                        className={`config-quota-picker-item${String(n) === customQuotaDraft ? ' config-quota-picker-item--selected' : ''}`}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="config-custom-quota-actions">
                  <button
                    type="button"
                    className="app-btn-danger"
                    onClick={() => { setCustomQuotaTarget(null); setCustomQuotaDraft(''); }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="app-btn-primary"
                    onClick={() => { void handleConfirmCustomQuota(); }}
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="config-edit-modal-header">
            <div className="config-client-plans-header-top">
              <h3>{t('config.clientPlansTitle')}</h3>
            </div>
            <p>{t('config.clientPlansSubtitle')}</p>
          </div>

          <div className="config-legal-scroll">
            {isLoadingManagedClients ? (
              <p className="config-rules-empty">{t('common.loading')}</p>
            ) : managedClients.length === 0 ? (
              <p className="config-rules-empty">{t('config.clientPlansEmpty')}</p>
            ) : (
              <div className="config-client-plans-list">
                <input
                  type="search"
                  className="app-input config-client-plans-search"
                  placeholder={t('config.clientPlansSearchPlaceholder')}
                  value={clientPlansSearch}
                  onChange={(event) => setClientPlansSearch(event.target.value)}
                />

                {filteredManagedClients.length === 0 ? (
                  <p className="config-rules-empty">{t('config.clientPlansNoMatches')}</p>
                ) : filteredManagedClients.map((clientUser) => {
                  const isSavingThisClient = savingClientId === clientUser.id;
                  const usageSummary = clientUsageMap[clientUser.id] ?? { used: 0, remaining: clientUser.monthly_booking_quota ?? null };
                  const usageText = clientUser.monthly_booking_quota === null || clientUser.monthly_booking_quota === undefined
                    ? t('config.clientPlansNoPlan')
                    : `${t('config.clientPlansUsedLabel')}: ${usageSummary.used} · ${t('config.clientPlansQuotaLabel')}: ${clientUser.monthly_booking_quota} · ${t('config.clientPlansRemainingLabel')}: ${usageSummary.remaining ?? 0}`;

                  return (
                    <div key={clientUser.id} className="config-client-plan-card">
                      <div className="config-client-plan-header">
                        <strong>{clientUser.name}</strong>
                        <span>{clientUser.email}</span>
                      </div>
                      <div className="config-client-plan-usage">
                        {usageText}
                      </div>

                      <label className="config-client-plan-row" htmlFor={`plan-active-${clientUser.id}`}>
                        <span>{t('config.clientPlansAccess')}</span>
                        <IonToggle
                          id={`plan-active-${clientUser.id}`}
                          checked={clientUser.is_active}
                          disabled={isSavingThisClient}
                          onIonChange={(event) => {
                            void handlePatchClient(clientUser.id, { is_active: event.detail.checked });
                          }}
                        />
                      </label>

                      <label className="config-client-plan-row" htmlFor={`plan-membership-${clientUser.id}`}>
                        <span>{t('config.clientPlansMembership')}</span>
                        <IonToggle
                          id={`plan-membership-${clientUser.id}`}
                          checked={clientUser.membership_active}
                          disabled={isSavingThisClient}
                          onIonChange={(event) => {
                            void handlePatchClient(clientUser.id, { membership_active: event.detail.checked });
                          }}
                        />
                      </label>

                      <label className="config-client-plan-row config-client-plan-row--quota" htmlFor={`plan-quota-${clientUser.id}`}>
                        <span>{t('config.clientPlansQuota')}</span>
                        <select
                          id={`plan-quota-${clientUser.id}`}
                          className="config-client-plan-select"
                          value={clientUser.monthly_booking_quota === null || clientUser.monthly_booking_quota === undefined
                            ? 'none'
                            : FIXED_PLAN_VALUES.includes(clientUser.monthly_booking_quota)
                              ? clientUser.monthly_booking_quota
                              : 'custom'}
                          disabled={isSavingThisClient}
                          onChange={(event) => {
                            if (event.target.value === 'custom') {
                              handleOpenCustomQuota(clientUser.id, clientUser.name, clientUser.monthly_booking_quota);
                            } else if (event.target.value === 'none') {
                              void handlePatchClient(clientUser.id, { monthly_booking_quota: null });
                            } else {
                              void handlePatchClient(clientUser.id, { monthly_booking_quota: Number(event.target.value) });
                            }
                          }}
                        >
                          {CLIENT_PLAN_OPTIONS.map((option) => (
                            <option key={option.label} value={option.value}>
                              {option.value === 'custom' && !FIXED_PLAN_VALUES.includes(clientUser.monthly_booking_quota ?? -1) && clientUser.monthly_booking_quota !== null && clientUser.monthly_booking_quota !== undefined
                                ? `${t('config.clientPlansCustomLabel')} (${clientUser.monthly_booking_quota})`
                                : option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="config-edit-actions">
            <button
              type="button"
              className="app-btn-danger config-edit-action-btn"
              onClick={() => setShowClientPlansModal(false)}
            >
              {t('common.close')}
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

      <IonModal
        className="config-delete-account-modal-wrapper"
        isOpen={showDeleteAccountConfirm}
        onDidDismiss={() => setShowDeleteAccountConfirm(false)}
      >
        <div className="config-delete-account-modal">
          <h3>{t('config.deleteAccount')}</h3>
          <p>{t('config.deleteAccountConfirm')}</p>
          <button type="button" className="app-btn-danger config-logout-btn" onClick={handleDeleteAccount}>
            <span>{t('config.deleteAccountConfirmBtn')}</span>
          </button>
          <button type="button" className="crear-btn-secondary" onClick={() => setShowDeleteAccountConfirm(false)}>
            <span>{t('config.deleteAccountCancel')}</span>
          </button>
        </div>
      </IonModal>
    </div>
  );
};

export default ConfigForm;