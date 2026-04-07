import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'es' | 'en';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  dateLocale: string;
};

const LANGUAGE_STORAGE_KEY = 'alesport-language';

const translations: Record<Language, Record<string, unknown>> = {
  es: {
    tabs: {
      agenda: 'Agenda',
      search: 'Buscar',
      create: 'Crear',
      options: 'Opciones',
    },
    common: {
      accept: 'Aceptar',
      cancel: 'Cancelar',
      close: 'Cerrar',
      loading: 'Cargando...',
      continue: 'Continuar',
      clear: 'Limpiar',
      apply: 'Aplicar',
      save: 'Guardar',
      edit: 'Editar sesión',
      details: 'Detalles',
    },
    config: {
      title: 'Opciones',
      nameFallback: 'Nombre',
      emailFallback: 'Correo electrónico',
      darkMode: 'Modo oscuro',
      language: 'Idioma',
      languageToggleAria: 'Cambiar idioma entre español e inglés',
      editProfile: 'Editar perfil',
      settings: 'Configuración',
      help: 'Ayuda y soporte',
      logout: 'Cerrar sesión',
      loggedOut: 'Sesión cerrada',
      editProfileTitle: 'Editar perfil',
      editProfileSubtitle: 'Aquí puedes cambiar tu nombre y añadir tu teléfono.',
      fullName: 'Nombre completo',
      phone: 'Teléfono',
      phonePlaceholder: 'Ej: +34 600 123 456',
      emailLabel: 'Correo',
      membershipLabel: 'Membresía',
      membershipActive: 'Activa',
      membershipInactive: 'Pendiente',
      profileUpdated: 'Perfil actualizado correctamente',
      profileUpdateError: 'No se pudo actualizar el perfil',
      profileNameRequired: 'El nombre debe tener al menos 2 caracteres',
      phoneInvalid: 'Introduce un teléfono válido de 9 dígitos (opcional +34)',
      phoneTooLong: 'El teléfono no puede superar 15 caracteres',
    },
    search: {
      title: 'Buscar reservas',
      adminOnly: 'Solo administradores pueden ver todas las reservas.',
      placeholder: 'Buscar por alumno, email o estado (activa/inactiva)',
      all: 'Todas',
      today: 'Hoy',
      week: 'Semana',
      month: 'Mes',
      selectDate: 'Seleccionar fecha',
      total: 'Reservas',
      active: 'Activas',
      cancelled: 'Canceladas',
      empty: 'No se encontraron reservas.',
      loadError: 'No se pudieron cargar las reservas',
      noEmail: 'Sin email',
      student: 'Alumno',
      status: 'Estado',
      time: 'Hora',
      date: 'Fecha',
      statusActive: 'Activa',
      statusCancelled: 'Cancelada',
    },
    create: {
      title: 'Crear clases',
      actionsTitle: '¿Qué quieres hacer?',
      option1: 'Opción 1',
      singleClass: 'Clase puntual',
      singleText: 'Para una sesión concreta en una fecha y hora determinadas.',
      option2: 'Opción 2',
      recurringSchedule: 'Horario recurrente',
      recurringText: 'Para generar clases repetidas con patrón semanal o mensual.',
      frequencyTitle: '¿Qué frecuencia quieres?',
      weekly: 'Semanal',
      monthly: 'Mensual',
      singleModalTitle: 'Crear clase puntual',
      recurringWeeklyModalTitle: 'Crear clase recurrente semanal',
      trainer: 'Entrenador',
      loadingTrainers: 'Cargando entrenadores...',
      selectTrainer: 'Selecciona entrenador',
      className: 'Nombre de la clase',
      singleClassNamePlaceholder: 'Ej: Fuerza, Spinning...',
      recurringClassNamePlaceholder: 'Ej: Yoga, Pilates...',
      date: 'Fecha',
      startDate: 'Fecha inicio (lunes)',
      endDate: 'Fecha fin (domingo)',
      capacity: 'Capacidad (1-10)',
      startTime: 'Hora inicio',
      endTime: 'Hora fin',
      startTimeTitle: 'Hora de inicio',
      endTimeTitle: 'Hora de fin',
      notes: 'Notas (opcional)',
      notesPlaceholder: 'Añade una observación para esta clase',
      invalidTimeRange: 'La hora de inicio debe ser anterior a la de fin.',
      invalidCapacity: 'La capacidad debe estar entre 1 y 10.',
      invalidTrainer: 'Debes seleccionar un entrenador válido.',
      preview: 'Vista previa',
      previewClass: 'Clase',
      previewDate: 'Fecha',
      previewSchedule: 'Horario',
      previewCapacity: 'Capacidad',
      previewTrainer: 'Entrenador',
      unnamed: 'Sin nombre',
      unassigned: 'Sin asignar',
      copyWeek: 'Copiar semana',
      copyWeekSource: 'Semana a copiar (origen)',
      copyWeekTarget: 'Semana destino',
      copy: 'Copiar',
    },
    calendar: {
      viewMonth: 'Ver mes',
      noClassesToday: 'No hay clases para hoy.',
      selectDate: 'Seleccionar fecha',
      editSession: 'Editar sesión',
      editSubtitle: 'Ajusta horario, capacidad y detalles de la clase',
      className: 'Nombre de la clase',
      classNamePlaceholder: 'Ej. Funcional',
      start: 'Inicio',
      end: 'Fin',
      capacity: 'Capacidad',
      notes: 'Notas',
      notesPlaceholder: 'Indicaciones internas u observaciones',
      deleteSession: 'Eliminar sesión',
      detailsTitle: 'Detalles de la clase',
      pastClassReadOnly: 'Clase pasada: solo lectura.',
      occupancy: 'Ocupación',
      noStudents: 'No hay alumnos apuntados.',
      noEmailAvailable: 'Sin email disponible',
      active: 'Activa',
      inactive: 'Inactiva',
      reactivate: 'Reactivar',
      cancelBooking: 'Cancelar',
    },
  },
  en: {
    tabs: {
      agenda: 'Diary',
      search: 'Search',
      create: 'Create',
      options: 'Options',
    },
    common: {
      accept: 'Accept',
      cancel: 'Cancel',
      close: 'Close',
      loading: 'Loading...',
      continue: 'Continue',
      clear: 'Clear',
      apply: 'Apply',
      save: 'Save',
      edit: 'Edit session',
      details: 'Details',
    },
    config: {
      title: 'Options',
      nameFallback: 'Name',
      emailFallback: 'Email address',
      darkMode: 'Dark mode',
      language: 'Language',
      languageToggleAria: 'Switch language between Spanish and English',
      editProfile: 'Edit profile',
      settings: 'Settings',
      help: 'Help and support',
      logout: 'Log out',
      loggedOut: 'Logged out',
      editProfileTitle: 'Edit profile',
      editProfileSubtitle: 'Here you can change your name and add your phone number.',
      fullName: 'Full name',
      phone: 'Phone',
      phonePlaceholder: 'Ex: +34 600 123 456',
      emailLabel: 'Email',
      membershipLabel: 'Membership',
      membershipActive: 'Active',
      membershipInactive: 'Pending',
      profileUpdated: 'Profile updated successfully',
      profileUpdateError: 'Profile could not be updated',
      profileNameRequired: 'Name must be at least 2 characters long',
      phoneInvalid: 'Enter a valid 9-digit phone number (optional +34)',
      phoneTooLong: 'Phone number cannot exceed 15 characters',
    },
    search: {
      title: 'Search bookings',
      adminOnly: 'Only administrators can view all bookings.',
      placeholder: 'Search by student, email or status (active/cancelled)',
      all: 'All',
      today: 'Today',
      week: 'Week',
      month: 'Month',
      selectDate: 'Select date',
      total: 'Bookings',
      active: 'Active',
      cancelled: 'Cancelled',
      empty: 'No bookings found.',
      loadError: 'Bookings could not be loaded',
      noEmail: 'No email',
      student: 'Student',
      status: 'Status',
      time: 'Time',
      date: 'Date',
      statusActive: 'Active',
      statusCancelled: 'Cancelled',
    },
    create: {
      title: 'Create classes',
      actionsTitle: 'What do you want to do?',
      option1: 'Option 1',
      singleClass: 'Single class',
      singleText: 'For one specific session on a selected date and time.',
      option2: 'Option 2',
      recurringSchedule: 'Recurring schedule',
      recurringText: 'To generate repeated classes with a weekly or monthly pattern.',
      frequencyTitle: 'Which frequency do you want?',
      weekly: 'Weekly',
      monthly: 'Monthly',
      singleModalTitle: 'Create single class',
      recurringWeeklyModalTitle: 'Create weekly recurring class',
      trainer: 'Trainer',
      loadingTrainers: 'Loading trainers...',
      selectTrainer: 'Select trainer',
      className: 'Class name',
      singleClassNamePlaceholder: 'Ex: Strength, Spinning...',
      recurringClassNamePlaceholder: 'Ex: Yoga, Pilates...',
      date: 'Date',
      startDate: 'Start date (Monday)',
      endDate: 'End date (Sunday)',
      capacity: 'Capacity (1-10)',
      startTime: 'Start time',
      endTime: 'End time',
      startTimeTitle: 'Start time',
      endTimeTitle: 'End time',
      notes: 'Notes (optional)',
      notesPlaceholder: 'Add a note for this class',
      invalidTimeRange: 'Start time must be earlier than end time.',
      invalidCapacity: 'Capacity must be between 1 and 10.',
      invalidTrainer: 'You must select a valid trainer.',
      preview: 'Preview',
      previewClass: 'Class',
      previewDate: 'Date',
      previewSchedule: 'Schedule',
      previewCapacity: 'Capacity',
      previewTrainer: 'Trainer',
      unnamed: 'Unnamed',
      unassigned: 'Unassigned',
      copyWeek: 'Copy week',
      copyWeekSource: 'Week to copy (source)',
      copyWeekTarget: 'Target week',
      copy: 'Copy',
    },
    calendar: {
      viewMonth: 'View month',
      noClassesToday: 'There are no classes for today.',
      selectDate: 'Select date',
      editSession: 'Edit session',
      editSubtitle: 'Adjust the schedule, capacity and class details',
      className: 'Class name',
      classNamePlaceholder: 'Ex. Functional',
      start: 'Start',
      end: 'End',
      capacity: 'Capacity',
      notes: 'Notes',
      notesPlaceholder: 'Internal notes or observations',
      deleteSession: 'Delete session',
      detailsTitle: 'Class details',
      pastClassReadOnly: 'Past class: read only.',
      occupancy: 'Occupancy',
      noStudents: 'No students enrolled.',
      noEmailAvailable: 'No email available',
      active: 'Active',
      inactive: 'Inactive',
      reactivate: 'Reactivate',
      cancelBooking: 'Cancel',
    },
  },
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function getNestedValue(source: Record<string, unknown>, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);

  return typeof value === 'string' ? value : undefined;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' ? 'en' : 'es';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback((key: string) => {
    return getNestedValue(translations[language], key)
      ?? getNestedValue(translations.es, key)
      ?? key;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t,
    dateLocale: language === 'en' ? 'en-GB' : 'es-ES',
  }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
}
