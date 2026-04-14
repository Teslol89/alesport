/* =================== TIPOS Y CONSTANTES =================== */
import logoIcon from '../icons/icon.png';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IonDatetime, IonModal } from '@ionic/react';
import { getAssignableTrainers, getEligibleFixedStudents, type AssignableTrainer, type FixedStudentCandidate } from '../api/user';
import { createSingleSession } from '../api/sessions';
import { createWeeklySchedule } from '../api/schedule';
import { copyWeekSessions } from '../api/sessions';
import { formatIsoDateForUi, fromPickerTimeIso, getTodayIsoDate, toPickerTimeIso, getMondayOfWeek, getSundayOfWeek } from '../utils/funcionesGeneral';
import CustomToast from './CustomStyles';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';
import './CrearForm.css';

/* =================== TIPOS Y CONSTANTES =================== */
type CreateMode = 'single' | 'recurring' | null;

type RecurrenceMode = 'weekly' | 'monthly';

type SingleSessionDraft = {
    className: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
    trainerId: number | null;
    trainerName: string;
    notes: string;
};

type RecurringSessionDraft = {
    className: string;
    startDate: string;
    endDate: string;
    daysOfWeek: number[]; // 0=Domingo, 1=Lunes, ...
    startTime: string;
    endTime: string;
    capacity: number;
    trainerId: number | null;
    trainerName: string;
    notes: string;
    fixedStudentIds: number[];
};

/* Fecha base para el time picker, que solo maneja horas y minutos.
Se usará una fecha fija y se ignorará al aplicar la hora seleccionada. */
const TIME_PICKER_BASE_DATE = '1970-01-01';

/* Componente principal para el formulario de creación,
que incluye la elección entre clase puntual o recurrente,
y el formulario específico para clase puntual en un modal. */
const CrearForm: React.FC = () => {
    const { t, dateLocale, } = useLanguage();
    const { user } = useAuth();
    // Bloqueo por membresía inactiva o sin plan
    if (user && (!user.is_active || !user.membership_active)) {
        return (
            <div className="crear-form-container app-blur-target">
                <div className="crear-top-bar">
                    <img src={logoIcon} alt="Logo gimnasio" className="crear-top-logo" />
                    <div className="crear-top-title crear-top-title-absolute">{t('create.title')}</div>
                </div>
                <div className="crear-form-content">
                    <p className="crear-form-blocked">
                        { !user.is_active
                            ? t('auth.inactiveUserBlocked')
                            : t('auth.membershipInactiveBlocked') }
                    </p>
                </div>
            </div>
        );
    }

    // Estado y refs para el time picker recurrente semanal
    const [showRecurringTimePicker, setShowRecurringTimePicker] = useState(false);
    const [recurringTimePickerTarget, setRecurringTimePickerTarget] = useState<'start' | 'end' | null>(null);
    const [recurringTimePickerValue, setRecurringTimePickerValue] = useState(toPickerTimeIso('09:00', TIME_PICKER_BASE_DATE));
    const recurringTimePanelRef = useRef<HTMLDivElement | null>(null);
    const recurringModalBodyRef = useRef<HTMLDivElement | null>(null);

    // Centrar el time picker recurrente semanal al abrirlo
    function scrollRecurringSubpanelIntoView(panelElement: HTMLDivElement | null) {
        const container = recurringModalBodyRef.current;
        if (!container || !panelElement) return;
        const containerCenter = container.clientHeight / 2;
        const panelTop = panelElement.offsetTop;
        const panelCenter = panelTop + panelElement.offsetHeight / 2;
        const targetScrollTop = panelCenter - containerCenter;
        container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
        });
    }
    useEffect(() => {
        if (showRecurringTimePicker && recurringTimePanelRef.current) {
            const timerId = window.setTimeout(() => {
                scrollRecurringSubpanelIntoView(recurringTimePanelRef.current);
            }, 40);
            return () => window.clearTimeout(timerId);
        }
    }, [showRecurringTimePicker]);

    // Abre el time picker para hora de inicio o fin en clase recurrente semanal
    function openRecurringTimePicker(target: 'start' | 'end') {
        if (showRecurringTimePicker && recurringTimePickerTarget === target) {
            setShowRecurringTimePicker(false);
            setRecurringTimePickerTarget(null);
            return;
        }

        closeAllRecurringSubmodals();
        const currentValue = target === 'start' ? recurringDraft.startTime : recurringDraft.endTime;
        const normalizedValue = currentValue ? currentValue.slice(0, 5) : '09:00';
        setRecurringTimePickerTarget(target);
        setRecurringTimePickerValue(toPickerTimeIso(normalizedValue, TIME_PICKER_BASE_DATE));
        setShowRecurringTimePicker(true);
    }

    function applyRecurringPickedTime() {
        const hmValue = fromPickerTimeIso(recurringTimePickerValue);
        if (!hmValue || !recurringTimePickerTarget) {
            setShowRecurringTimePicker(false);
            setRecurringTimePickerTarget(null);
            return;
        }
        if (recurringTimePickerTarget === 'start') {
            setRecurringDraft((prev) => ({ ...prev, startTime: hmValue }));
        } else {
            setRecurringDraft((prev) => ({ ...prev, endTime: hmValue }));
        }
        setShowRecurringTimePicker(false);
        setRecurringTimePickerTarget(null);
    }
    // =================== ESTADO Y REFERENCIAS (HOOKS) ===================
    const [createMode, setCreateMode] = useState<CreateMode>(null);
    const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode | null>(null);
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [showSingleDatePicker, setShowSingleDatePicker] = useState(false);
    const [showSingleTimePicker, setShowSingleTimePicker] = useState(false);
    const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
    const [timePickerValue, setTimePickerValue] = useState(toPickerTimeIso('09:00', TIME_PICKER_BASE_DATE));
    const [showCapacityPicker, setShowCapacityPicker] = useState(false);
    const [showTrainerPicker, setShowTrainerPicker] = useState(false);
    const [trainerOptions, setTrainerOptions] = useState<AssignableTrainer[]>([]);
    const [fixedStudentOptions, setFixedStudentOptions] = useState<FixedStudentCandidate[]>([]);
    const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
    const [isLoadingFixedStudents, setIsLoadingFixedStudents] = useState(false);
    const [trainersError, setTrainersError] = useState<string | null>(null);
    const [fixedStudentsError, setFixedStudentsError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'danger' | 'info' }>({
        show: false,
        message: '',
        type: 'info',
    });
    const openSingleModalRafRef = useRef<number | null>(null);
    const singleModalBodyRef = useRef<HTMLDivElement | null>(null);
    const singleDatePanelRef = useRef<HTMLDivElement | null>(null);
    const singleCapacityPanelRef = useRef<HTMLDivElement | null>(null);
    const singleTrainerPanelRef = useRef<HTMLDivElement | null>(null);
    const singleTimePanelRef = useRef<HTMLDivElement | null>(null);
    const [singleDraft, setSingleDraft] = useState<SingleSessionDraft>({
        className: '',
        sessionDate: getTodayIsoDate(),
        startTime: '09:00',
        endTime: '10:00',
        capacity: 10,
        trainerId: null,
        trainerName: '',
        notes: '',
    });

    /* El draft para la clase recurrente se inicializa con valores por defecto. */
    const [recurringDraft, setRecurringDraft] = useState<RecurringSessionDraft>({
        className: '',
        startDate: getTodayIsoDate(),
        endDate: getTodayIsoDate(),
        daysOfWeek: [],
        startTime: '09:00',
        endTime: '10:00',
        capacity: 10,
        trainerId: null,
        trainerName: '',
        notes: '',
        fixedStudentIds: [],
    });

    const selectedRecurringFixedStudents = useMemo(
        () => fixedStudentOptions.filter((student) => recurringDraft.fixedStudentIds.includes(student.id)),
        [fixedStudentOptions, recurringDraft.fixedStudentIds]
    );

    // --- Lógica del picker de entrenador recurrente ---
    // (Agrupada aquí para claridad, cerca del modal recurrente)
    const [showRecurringTrainerPicker, setShowRecurringTrainerPicker] = useState(false);
    const [showRecurringFixedStudentsModal, setShowRecurringFixedStudentsModal] = useState(false);
    const [recurringFixedStudentsSearch, setRecurringFixedStudentsSearch] = useState('');
    const [recurringFixedStudentsDraftIds, setRecurringFixedStudentsDraftIds] = useState<number[]>([]);
    const recurringTrainerPanelRef = useRef<HTMLDivElement | null>(null);

    const recurringFixedStudentsTriggerLabel = useMemo(() => {
        if (selectedRecurringFixedStudents.length === 0) {
            return t('create.selectFixedStudents');
        }

        if (selectedRecurringFixedStudents.length <= 2) {
            return selectedRecurringFixedStudents.map((student) => student.name).join(', ');
        }

        const previewNames = selectedRecurringFixedStudents.slice(0, 2).map((student) => student.name).join(', ');
        return `${previewNames} +${selectedRecurringFixedStudents.length - 2}`;
    }, [selectedRecurringFixedStudents, t]);

    const filteredFixedStudentOptions = useMemo(() => {
        const query = recurringFixedStudentsSearch.trim().toLowerCase();
        if (!query) {
            return fixedStudentOptions;
        }

        return fixedStudentOptions.filter((student) => (
            student.name.toLowerCase().includes(query)
            || student.email.toLowerCase().includes(query)
        ));
    }, [fixedStudentOptions, recurringFixedStudentsSearch]);

    // Estado para mostrar/ocultar el date picker y capacity picker recurrente semanal
    const [showRecurringDatePicker, setShowRecurringDatePicker] = useState(false);
    const [showRecurringCapacityPicker, setShowRecurringCapacityPicker] = useState(false);
    const recurringCapacityPanelRef = useRef<HTMLDivElement | null>(null);

    // Cierra todos los submodales de la clase recurrente semanal
    function closeAllRecurringSubmodals() {
        setShowRecurringTrainerPicker(false);
        setShowRecurringFixedStudentsModal(false);
        setShowRecurringDatePicker(false);
        setShowRecurringTimePicker(false);
        setShowRecurringCapacityPicker(false);
    }

    // Abre/cierra el picker de capacidad recurrente semanal
    function toggleRecurringCapacityPicker() {
        const nextOpen = !showRecurringCapacityPicker;
        closeAllRecurringSubmodals();
        setShowRecurringCapacityPicker(nextOpen);
    }

    // Selecciona la capacidad en recurrente semanal
    function pickRecurringCapacity(value: number) {
        setRecurringDraft((prev) => ({ ...prev, capacity: value }));
        closeAllRecurringSubmodals();
    }

    // Abre/cierra el picker de entrenador recurrente semanal
    function toggleRecurringTrainerPicker() {
        if (showRecurringTrainerPicker) {
            setShowRecurringTrainerPicker(false);
            return;
        }

        closeAllRecurringSubmodals();
        setShowRecurringTrainerPicker(true);
    }

    // Selecciona el entrenador en recurrente semanal
    function pickRecurringTrainer(trainer: AssignableTrainer) {
        setRecurringDraft((prev) => ({ ...prev, trainerId: trainer.id, trainerName: trainer.name }));
        setShowRecurringTrainerPicker(false);
    }

    function openRecurringFixedStudentsModal() {
        closeAllRecurringSubmodals();
        setRecurringFixedStudentsDraftIds([...recurringDraft.fixedStudentIds]);
        setRecurringFixedStudentsSearch('');
        setShowRecurringFixedStudentsModal(true);
    }

    function closeRecurringFixedStudentsModal() {
        setShowRecurringFixedStudentsModal(false);
        setRecurringFixedStudentsSearch('');
    }

    function toggleRecurringFixedStudent(studentId: number) {
        setRecurringFixedStudentsDraftIds((currentIds) => {
            const isSelected = currentIds.includes(studentId);
            if (!isSelected && currentIds.length >= recurringDraft.capacity) {
                setToast({
                    show: true,
                    message: t('create.fixedStudentsLimit'),
                    type: 'danger',
                });
                return currentIds;
            }

            return isSelected
                ? currentIds.filter((id) => id !== studentId)
                : [...currentIds, studentId];
        });
    }

    function applyRecurringFixedStudentsSelection() {
        setRecurringDraft((draft) => ({ ...draft, fixedStudentIds: recurringFixedStudentsDraftIds }));
        closeRecurringFixedStudentsModal();
    }

    function closeRecurringSubmodalsOnEmptyClick(e: React.MouseEvent<HTMLElement>) {
        if (e.target === e.currentTarget) {
            closeAllRecurringSubmodals();
        }
    }

    function toggleRecurringDatePicker() {
        if (showRecurringDatePicker) {
            setShowRecurringDatePicker(false);
            return;
        }
        closeAllRecurringSubmodals();
        setShowRecurringDatePicker(true);
        setTimeout(() => {
            const panel = document.querySelector('.crear-single-date-panel');
            if (panel && recurringModalBodyRef.current) {
                scrollRecurringSubpanelIntoView(panel as HTMLDivElement);
            }
        }, 50);
    }
    // Centrar el panel de capacidad recurrente al abrirlo
    useEffect(() => {
        if (showRecurringCapacityPicker && recurringCapacityPanelRef.current && recurringModalBodyRef.current) {
            const timerId = window.setTimeout(() => {
                scrollRecurringSubpanelIntoView(recurringCapacityPanelRef.current);
            }, 40);
            return () => window.clearTimeout(timerId);
        }
    }, [showRecurringCapacityPicker]);

    const isSingleTimeRangeValid = singleDraft.startTime < singleDraft.endTime;
    const isSingleCapacityValid = singleDraft.capacity >= 1 && singleDraft.capacity <= 10;
    const isSingleTrainerValid = singleDraft.trainerId !== null;
    const isSingleRequiredValid = singleDraft.className.trim().length > 0 && singleDraft.sessionDate.length > 0 && isSingleTrainerValid;
    const isSingleValid = isSingleTimeRangeValid && isSingleCapacityValid && isSingleRequiredValid;

    function closeAllSingleSubmodals() {
        setShowSingleDatePicker(false);
        setShowSingleTimePicker(false);
        setShowCapacityPicker(false);
        setShowTrainerPicker(false);
    }

    function toggleSingleDatePicker() {
        const nextOpen = !showSingleDatePicker;
        closeAllSingleSubmodals();
        setShowSingleDatePicker(nextOpen);
        // Si se va a abrir, centrar el panel tras un pequeño retardo
        if (!showSingleDatePicker && singleDatePanelRef.current && singleModalBodyRef.current) {
            setTimeout(() => {
                scrollSubpanelIntoView(singleDatePanelRef.current);
            }, 50);
        }
    }

    function toggleCapacityPicker() {
        const nextOpen = !showCapacityPicker;
        closeAllSingleSubmodals();
        setShowCapacityPicker(nextOpen);
    }

    function toggleTrainerPicker() {
        const nextOpen = !showTrainerPicker;
        closeAllSingleSubmodals();
        setShowTrainerPicker(nextOpen);
    }

    // =================== EFECTOS (useEffect) ===================
    useEffect(() => {
        let cancelled = false;

        async function loadPickerData() {
            setIsLoadingTrainers(true);
            setIsLoadingFixedStudents(true);
            setTrainersError(null);
            setFixedStudentsError(null);

            const [trainersResult, fixedStudentsResult] = await Promise.allSettled([
                getAssignableTrainers(),
                getEligibleFixedStudents(),
            ]);

            if (cancelled) {
                return;
            }

            if (trainersResult.status === 'fulfilled') {
                setTrainerOptions(trainersResult.value);
            } else {
                setTrainerOptions([]);
                setTrainersError('No se pudieron cargar los entrenadores.');
            }

            if (fixedStudentsResult.status === 'fulfilled') {
                setFixedStudentOptions(fixedStudentsResult.value);
            } else {
                setFixedStudentOptions([]);
                setFixedStudentsError('No se pudieron cargar los alumnos activos.');
            }

            setIsLoadingTrainers(false);
            setIsLoadingFixedStudents(false);
        }

        void loadPickerData();

        return () => {
            cancelled = true;
        };
    }, []);

    function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!isSingleValid) {
            setToast({
                show: true,
                message: 'Revisa los campos obligatorios y el rango de horas antes de continuar.',
                type: 'danger',
            });
            return;
        }

        createSingleSession({
            session_date: singleDraft.sessionDate,
            start_time: singleDraft.startTime,
            end_time: singleDraft.endTime,
            capacity: singleDraft.capacity,
            class_name: singleDraft.className.trim(),
            notes: singleDraft.notes.trim() || undefined,
            trainer_id: singleDraft.trainerId || undefined,
        })
            .then(() => {
                setToast({
                    show: true,
                    message: '✓ Sesión creada exitosamente',
                    type: 'success',
                });
                setTimeout(() => {
                    setShowSingleModal(false);
                    resetSingleDraft();
                }, 1000);
            })
            .catch((error) => {
                setToast({
                    show: true,
                    message: `Error: ${error.message || 'No se pudo crear la sesión'}`,
                    type: 'danger',
                });
            });
    }

    function resetSingleDraft() {
        setSingleDraft({
            className: '',
            sessionDate: getTodayIsoDate(),
            startTime: '09:00',
            endTime: '10:00',
            capacity: 10,
            trainerId: null,
            trainerName: '',
            notes: '',
        });
        closeAllSingleSubmodals();
    }

    // Abre el time picker para hora de inicio o fin en clase puntual
    function openTimePicker(target: 'start' | 'end') {
        if (showSingleTimePicker && timePickerTarget === target) {
            setShowSingleTimePicker(false);
            setTimePickerTarget(null);
            return;
        }
        closeAllSingleSubmodals();
        setTimeout(() => {
            const currentValue = target === 'start' ? singleDraft.startTime : singleDraft.endTime;
            const normalizedValue = currentValue ? currentValue.slice(0, 5) : '09:00';
            setTimePickerTarget(target);
            setTimePickerValue(toPickerTimeIso(normalizedValue, TIME_PICKER_BASE_DATE));
            setShowSingleTimePicker(true);
        }, 10);
    }

    function applyPickedTime() {
        const hmValue = fromPickerTimeIso(timePickerValue);
        if (!hmValue || !timePickerTarget) {
            closeAllSingleSubmodals();
            return;
        }
        if (timePickerTarget === 'start') {
            setSingleDraft((prev) => ({ ...prev, startTime: hmValue }));
        } else {
            setSingleDraft((prev) => ({ ...prev, endTime: hmValue }));
        }
        closeAllSingleSubmodals();
    }

    function pickCapacity(value: number) {
        setSingleDraft((prev) => ({ ...prev, capacity: value }));
        closeAllSingleSubmodals();
    }

    function pickTrainer(trainer: AssignableTrainer) {
        setSingleDraft((prev) => ({ ...prev, trainerId: trainer.id, trainerName: trainer.name }));
        closeAllSingleSubmodals();
    }

    function closeSubmodalsOnEmptyClick(e: React.MouseEvent<HTMLElement>) {
        if (e.target === e.currentTarget) {
            closeAllSingleSubmodals();
        }
    }

    function openSingleModalSmoothly() {
        setShowSingleModal(true);
    }

    function scrollSubpanelIntoView(panelElement: HTMLDivElement | null) {
        const container = singleModalBodyRef.current;
        if (!container || !panelElement) {
            return;
        }

        const containerCenter = container.clientHeight / 2;
        const panelTop = panelElement.offsetTop;
        const panelCenter = panelTop + panelElement.offsetHeight / 2;
        const targetScrollTop = panelCenter - containerCenter;

        container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
        });
    }

    useEffect(() => {
        let activePanel: HTMLDivElement | null = null;
        if (showSingleDatePicker) {
            activePanel = singleDatePanelRef.current;
        } else if (showCapacityPicker) {
            activePanel = singleCapacityPanelRef.current;
        } else if (showTrainerPicker) {
            activePanel = singleTrainerPanelRef.current;
        } else if (showSingleTimePicker) {
            activePanel = singleTimePanelRef.current;
        }

        if (!activePanel) {
            return;
        }

        const timerId = window.setTimeout(() => {
            scrollSubpanelIntoView(activePanel);
        }, 40);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [showSingleDatePicker, showCapacityPicker, showTrainerPicker, showSingleTimePicker]);

    useEffect(() => {
        return () => {
            if (openSingleModalRafRef.current !== null) {
                window.cancelAnimationFrame(openSingleModalRafRef.current);
            }
        };
    }, []);

    // Cuando se selecciona semanal, poner lunes y domingo de la semana actual
    useEffect(() => {
        if (showRecurringModal && recurrenceMode === 'weekly') {
            const todayIso = getTodayIsoDate();
            const mondayIso = getMondayOfWeek(todayIso);
            const sundayIso = getSundayOfWeek(mondayIso);
            setRecurringDraft(draft => ({
                ...draft,
                startDate: mondayIso,
                endDate: sundayIso,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showRecurringModal, recurrenceMode]);

    // Estado para el modal de copiar semana
    const [showCopyWeekModal, setShowCopyWeekModal] = useState(false);
    const [copyWeekSource, setCopyWeekSource] = useState("");
    const [copyWeekTarget, setCopyWeekTarget] = useState("");
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showTargetPicker, setShowTargetPicker] = useState(false);
    function formatDateDMY(iso: string) {
        if (!iso) return "-";
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${y}`;
    }
    function getWeekRange(isoMonday: string) {
        if (!isoMonday) return "-";
        const monday = new Date(isoMonday);
        if (monday.getDay() !== 1) return "(elige un lunes)";
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `${formatDateDMY(isoMonday)} - ${formatDateDMY(sunday.toISOString().slice(0, 10))}`;
    }

    // Handler para copiar semana usando el backend real (opción 1: sin trainer_id)
    async function handleCopyWeek() {
        if (!copyWeekSource || !copyWeekTarget) return;
        try {
            await copyWeekSessions({
                source_week_start_date: copyWeekSource,
                target_week_start_date: copyWeekTarget
                // NO enviar trainer_id
            });
            setToast({
                show: true,
                message: `✓ Semana copiada correctamente`,
                type: 'success',
            });
            setShowCopyWeekModal(false);
            setCopyWeekSource("");
            setCopyWeekTarget("");
        } catch (error: any) {
            setToast({
                show: true,
                message: error?.message || 'Error al copiar la semana',
                type: 'danger',
            });
        }
    }

    return (
        <div className={`crear-form-container app-blur-target ${(showSingleModal || showRecurringModal) ? 'app-blur-target--modal-open' : ''}`}>
            <div className="crear-top-bar">
                <img src={logoIcon} alt="Logo gimnasio" className="crear-top-logo" />
                <div className="crear-top-title crear-top-title-absolute">{t('create.title')}</div>
            </div>

            <div className="crear-form-content">

                {/* Elección de clase puntual o recurrente */}
                <section className="crear-form-section">
                    <h2 className="crear-form-section-title">{t('create.actionsTitle')}</h2>
                    <div className="crear-mode-grid">
                        <button
                            type="button"
                            className={`crear-mode-card ${createMode === 'single' ? 'selected' : ''}`}
                            onClick={() => {
                                closeAllSingleSubmodals();
                                openSingleModalSmoothly();
                                setCreateMode('single');
                            }}
                        >
                            <span className="crear-mode-card-kicker">{t('create.option1')}</span>
                            <span className="crear-mode-card-title">{t('create.singleClass')}</span>
                            <span className="crear-mode-card-text">
                                {t('create.singleText')}
                            </span>
                        </button>

                        <button
                            type="button"
                            className={`crear-mode-card ${createMode === 'recurring' ? 'selected' : ''}`}
                            onClick={() => {
                                setCreateMode('recurring');
                                setRecurrenceMode(null);
                            }}
                        >
                            <span className="crear-mode-card-kicker">{t('create.option2')}</span>
                            <span className="crear-mode-card-title">{t('create.recurringSchedule')}</span>
                            <span className="crear-mode-card-text">
                                {t('create.recurringText')}
                            </span>
                        </button>
                    </div>
                </section>

                {createMode === 'recurring' && (
                    <section className="crear-form-section">
                        <h2 className="crear-form-section-title">{t('create.frequencyTitle')}</h2>
                        <div className="crear-frequency-row">
                            <button
                                type="button"
                                className={`crear-frequency-pill${recurrenceMode === 'weekly' ? ' selected' : ''}`}
                                onClick={() => {
                                    setRecurrenceMode('weekly');
                                    setShowRecurringModal(true);
                                }}
                            >
                                {t('create.weekly')}
                            </button>
                            <button
                                type="button"
                                className={`crear-frequency-pill${recurrenceMode === 'monthly' ? ' selected' : ''}`}
                                onClick={() => {
                                    setRecurrenceMode('monthly');
                                    // Aquí puedes abrir el modal mensual cuando lo implementes
                                }}
                            >
                                {t('create.monthly')}
                            </button>
                        </div>
                    </section>
                )}

                {/* Aquí van los modales específicos para cada tipo de clase */}
                {/* Modal para clase puntual */}
                <IonModal
                    className="crear-single-modal-wrapper"
                    isOpen={showSingleModal}
                    keepContentsMounted={true}
                    onDidDismiss={() => {
                        setShowSingleModal(false);
                        closeAllSingleSubmodals();
                    }}
                >
                    <div className="crear-single-modal" onClick={closeSubmodalsOnEmptyClick} ref={singleModalBodyRef}>
                        <div className="crear-single-modal-header">
                            <h3>{t('create.singleModalTitle')}</h3>
                            <button
                                type="button"
                                className="crear-single-modal-close"
                                onClick={() => {
                                    setShowSingleModal(false);
                                    closeAllSingleSubmodals();
                                }}
                                aria-label={t('common.close')}
                            >
                                ×
                            </button>
                        </div>

                        <form className="crear-single-form" onSubmit={handleSingleSubmit} onClick={closeSubmodalsOnEmptyClick}>

                            {/* Campo Entrenador */}
                            <label className="crear-field-label" htmlFor="single-trainer-role">{t('create.trainer')}</label>
                            <button
                                id="single-trainer-role"
                                type="button"
                                className="crear-input crear-date-btn"
                                disabled={isLoadingTrainers || trainerOptions.length === 0}
                                onClick={toggleTrainerPicker}
                            >
                                {isLoadingTrainers ? t('create.loadingTrainers') : (singleDraft.trainerName || t('create.selectTrainer'))}
                            </button>

                            {showTrainerPicker ? (
                                <div className="crear-trainer-picker-panel" ref={singleTrainerPanelRef}>
                                    {trainerOptions.map((trainer) => (
                                        <button
                                            key={trainer.id}
                                            type="button"
                                            className={`crear-trainer-option ${singleDraft.trainerId === trainer.id ? 'selected' : ''}`}
                                            onClick={() => pickTrainer(trainer)}
                                        >
                                            <span className="crear-trainer-name">{trainer.name}</span>
                                            <span className="crear-trainer-role">{trainer.role}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {trainersError ? <p className="crear-validation-error">{trainersError}</p> : null}

                            {/* Campo Nombre de la clase */}
                            <label className="crear-field-label" htmlFor="single-class-name">{t('create.className')}</label>
                            <input
                                id="single-class-name"
                                className="crear-input"
                                type="text"
                                value={singleDraft.className}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, className: e.target.value }))}
                                placeholder={t('create.singleClassNamePlaceholder')}
                            />

                            {/* Campo Fecha */}
                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="single-session-date-btn">{t('create.date')}</label>
                                    <button
                                        id="single-session-date-btn"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={toggleSingleDatePicker}
                                    >
                                        {formatIsoDateForUi(singleDraft.sessionDate)}
                                    </button>

                                    {showSingleDatePicker ? (
                                        <div className="crear-single-date-panel" ref={singleDatePanelRef}>
                                            <IonDatetime
                                                className="crear-single-date-calendar"
                                                presentation="date"
                                                firstDayOfWeek={1}
                                                locale={dateLocale}
                                                value={singleDraft.sessionDate}
                                                onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                                    const next = e.detail.value;
                                                    if (typeof next === 'string') {
                                                        setSingleDraft((prev) => ({ ...prev, sessionDate: next.slice(0, 10) }));
                                                        setShowSingleDatePicker(false);
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                {/* Campo Capacidad */}
                                <div>
                                    <label className="crear-field-label" htmlFor="single-capacity">{t('create.capacity')}</label>
                                    <button
                                        id="single-capacity"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={toggleCapacityPicker}
                                    >
                                        {singleDraft.capacity}
                                    </button>

                                    {showCapacityPicker ? (
                                        <div className="crear-capacity-picker-panel" ref={singleCapacityPanelRef}>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    className={`crear-capacity-option ${singleDraft.capacity === value ? 'selected' : ''}`}
                                                    onClick={() => pickCapacity(value)}
                                                >
                                                    {value}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {/* Campo Hora Inicio */}
                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="single-start-time">{t('create.startTime')}</label>
                                    <button
                                        id="single-start-time"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={() => openTimePicker('start')}
                                    >
                                        {singleDraft.startTime || '--:--'}
                                    </button>
                                </div>

                                {/* Campo Hora Fin */}
                                <div>
                                    <label className="crear-field-label" htmlFor="single-end-time">{t('create.endTime')}</label>
                                    <button
                                        id="single-end-time"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={() => openTimePicker('end')}
                                    >
                                        {singleDraft.endTime || '--:--'}
                                    </button>
                                </div>
                            </div>

                            {showSingleTimePicker ? (
                                <div className="crear-time-picker-panel" ref={singleTimePanelRef}>
                                    <h4>{timePickerTarget === 'start' ? t('create.startTimeTitle') : t('create.endTimeTitle')}</h4>
                                    <IonDatetime
                                        className="crear-time-picker"
                                        presentation="time"
                                        preferWheel={true}
                                        minuteValues="0,30"
                                        value={timePickerValue}
                                        onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                            const nextValue = e.detail.value;
                                            if (typeof nextValue === 'string') {
                                                setTimePickerValue(nextValue);
                                            }
                                        }}
                                    />
                                    <div className="crear-time-picker-actions">
                                        <button type="button" className="crear-btn-primary" onClick={applyPickedTime}>
                                            {t('common.apply')}
                                        </button>
                                        <button type="button" className="app-btn-danger" onClick={closeAllSingleSubmodals}>
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Campo Notas */}
                            <label className="crear-field-label" htmlFor="single-notes">{t('create.notes')}</label>
                            <textarea
                                id="single-notes"
                                className="crear-textarea"
                                value={singleDraft.notes}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Añade una observación para esta clase"
                            />

                            {!isSingleTimeRangeValid ? (
                                <p className="crear-validation-error">{t('create.invalidTimeRange')}</p>
                            ) : null}

                            {!isSingleCapacityValid ? (
                                <p className="crear-validation-error">{t('create.invalidCapacity')}</p>
                            ) : null}

                            {!isSingleTrainerValid ? (
                                <p className="crear-validation-error">{t('create.invalidTrainer')}</p>
                            ) : null}

                            <div className="crear-preview-card crear-single-preview">
                                <p><strong>{t('create.preview')}</strong></p>
                                <p>{t('create.previewClass')}: {singleDraft.className.trim() || t('create.unnamed')}</p>
                                <p>{t('create.previewDate')}: {singleDraft.sessionDate ? formatIsoDateForUi(singleDraft.sessionDate, '/') : '-'}</p>
                                <p>{t('create.previewSchedule')}: {singleDraft.startTime} - {singleDraft.endTime}</p>
                                <p>{t('create.previewCapacity')}: {singleDraft.capacity}</p>
                                <p>{t('create.previewTrainer')}: {singleDraft.trainerName.trim() || t('create.unassigned')}</p>
                            </div>

                            <div className="crear-actions-row">
                                <button
                                    type="button"
                                    className="crear-btn-secondary"
                                    onClick={(e) => {
                                        const button = e.currentTarget;
                                        button.classList.add('crear-btn-secondary-tap');
                                        window.setTimeout(() => {
                                            button.classList.remove('crear-btn-secondary-tap');
                                            button.blur();
                                        }, 140);
                                        resetSingleDraft();
                                    }}
                                >
                                    {t('common.clear')}
                                </button>
                                <button type="submit" className="crear-btn-primary" disabled={!isSingleValid}>
                                    {t('common.continue')}
                                </button>
                            </div>
                        </form>
                    </div>
                </IonModal>

                {/* Modal para clase recurrente semanal */}
                <IonModal
                    className="crear-single-modal-wrapper"
                    isOpen={showRecurringModal && recurrenceMode === 'weekly'}
                    keepContentsMounted={true}
                    onDidDismiss={() => {
                        setShowRecurringModal(false);
                        closeAllRecurringSubmodals();
                        setRecurringFixedStudentsSearch('');
                    }}
                >
                    <div
                        className={`crear-single-modal ${(showCopyWeekModal || showRecurringFixedStudentsModal) ? 'app-stacked-modal-dimmed' : ''}`}
                        onClick={closeRecurringSubmodalsOnEmptyClick}
                        ref={recurringModalBodyRef}
                    >
                        <div className="crear-single-modal-header">
                            <h3>{t('create.recurringWeeklyModalTitle')}</h3>
                            <button
                                type="button"
                                className="crear-single-modal-close"
                                onClick={() => {
                                    setShowRecurringModal(false);
                                    closeAllRecurringSubmodals();
                                }}
                                aria-label={t('common.close')}
                            >
                                ×
                            </button>
                        </div>
                        <form className="crear-single-form">
                            {/* Modal de copiar semana: permite elegir semana origen y destino */}
                            <IonModal
                                className="crear-single-modal-wrapper"
                                isOpen={showCopyWeekModal}
                                onDidDismiss={() => {
                                    setShowCopyWeekModal(false);
                                    setCopyWeekSource("");
                                    setCopyWeekTarget("");
                                    setShowSourcePicker(false);
                                    setShowTargetPicker(false);
                                }}
                                backdropDismiss={true}
                            >
                                <div className="crear-single-modal">
                                    <h3 className="crear-copy-week-title">{t('create.copyWeek')}</h3>
                                    <form className="crear-single-form" onSubmit={e => { e.preventDefault(); handleCopyWeek(); }}>
                                        <div className="crear-copy-week-row">
                                            <label className="crear-field-label">{t('create.copyWeekSource')}</label>
                                            <button
                                                type="button"
                                                className="crear-input crear-date-btn"
                                                onClick={() => setShowSourcePicker(v => !v)}
                                            >
                                                {getWeekRange(copyWeekSource)}
                                            </button>
                                            {showSourcePicker && (
                                                <div className="crear-single-date-panel crear-copy-week-date-panel">
                                                    <IonDatetime
                                                        className="crear-single-date-calendar"
                                                        presentation="date"
                                                        firstDayOfWeek={1}
                                                        locale={dateLocale}
                                                        value={copyWeekSource}
                                                        min="2020-01-01"
                                                        max="2100-12-31"
                                                        isDateEnabled={(isoDate: string) => {
                                                            const d = new Date(isoDate);
                                                            return d.getDay() === 1;
                                                        }}
                                                        onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                                            const value = e.detail.value;
                                                            if (typeof value === 'string') {
                                                                const d = new Date(value);
                                                                if (d.getDay() === 1) {
                                                                    setCopyWeekSource(value.slice(0, 10));
                                                                    setShowSourcePicker(false);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="crear-copy-week-row">
                                            <label className="crear-field-label">{t('create.copyWeekTarget')}</label>
                                            <button
                                                type="button"
                                                className="crear-input crear-date-btn"
                                                onClick={() => setShowTargetPicker(v => !v)}
                                            >
                                                {getWeekRange(copyWeekTarget)}
                                            </button>
                                            {showTargetPicker && (
                                                <div className="crear-single-date-panel crear-copy-week-date-panel">
                                                    <IonDatetime
                                                        className="crear-single-date-calendar"
                                                        presentation="date"
                                                        firstDayOfWeek={1}
                                                        locale={dateLocale}
                                                        value={copyWeekTarget}
                                                        min="2020-01-01"
                                                        max="2100-12-31"
                                                        isDateEnabled={(isoDate: string) => {
                                                            const d = new Date(isoDate);
                                                            return d.getDay() === 1;
                                                        }}
                                                        onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                                            const value = e.detail.value;
                                                            if (typeof value === 'string') {
                                                                const d = new Date(value);
                                                                if (d.getDay() === 1) {
                                                                    setCopyWeekTarget(value.slice(0, 10));
                                                                    setShowTargetPicker(false);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="crear-actions-row">
                                            <button
                                                type="submit"
                                                className="crear-btn-primary"
                                                disabled={!copyWeekSource || !copyWeekTarget}
                                            >
                                                {t('create.copy')}
                                            </button>
                                            <button
                                                type="button"
                                                className="app-btn-danger"
                                                onClick={() => {
                                                    setShowCopyWeekModal(false);
                                                    setCopyWeekSource("");
                                                    setCopyWeekTarget("");
                                                    setShowSourcePicker(false);
                                                    setShowTargetPicker(false);
                                                }}
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </IonModal>
                            {/* Campo Entrenador */}
                            <label className="crear-field-label" htmlFor="rec-trainer-role">{t('create.trainer')}</label>
                            <button
                                id="rec-trainer-role"
                                type="button"
                                className="crear-input crear-date-btn"
                                disabled={isLoadingTrainers || trainerOptions.length === 0}
                                onClick={toggleRecurringTrainerPicker}
                            >
                                {isLoadingTrainers ? t('create.loadingTrainers') : (recurringDraft.trainerName || t('create.selectTrainer'))}
                            </button>

                            {showRecurringTrainerPicker ? (
                                <div className="crear-trainer-picker-panel" ref={recurringTrainerPanelRef}>
                                    {trainerOptions.map((trainer) => (
                                        <button
                                            key={trainer.id}
                                            type="button"
                                            className={`crear-trainer-option ${recurringDraft.trainerId === trainer.id ? 'selected' : ''}`}
                                            onClick={() => pickRecurringTrainer(trainer)}
                                        >
                                            <span className="crear-trainer-name">{trainer.name}</span>
                                            <span className="crear-trainer-role">{trainer.role}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {trainersError ? <p className="crear-validation-error">{trainersError}</p> : null}

                            <label className="crear-field-label" htmlFor="rec-fixed-students">{t('create.fixedStudents')}</label>
                            <button
                                id="rec-fixed-students"
                                type="button"
                                className="crear-input crear-date-btn"
                                disabled={isLoadingFixedStudents || fixedStudentOptions.length === 0}
                                onClick={openRecurringFixedStudentsModal}
                            >
                                {isLoadingFixedStudents ? t('create.loadingFixedStudents') : recurringFixedStudentsTriggerLabel}
                            </button>
                            {fixedStudentsError ? <p className="crear-validation-error">{fixedStudentsError}</p> : null}
                            {selectedRecurringFixedStudents.length > recurringDraft.capacity ? (
                                <p className="crear-validation-error">{t('create.fixedStudentsLimit')}</p>
                            ) : null}

                            <IonModal
                                className="crear-fixed-students-modal-wrapper"
                                isOpen={showRecurringFixedStudentsModal}
                                onDidDismiss={closeRecurringFixedStudentsModal}
                            >
                                <div className="crear-fixed-students-modal">
                                    <div className="crear-single-modal-header">
                                        <h3>{t('create.fixedStudents')}</h3>
                                        <button
                                            type="button"
                                            className="crear-single-modal-close"
                                            onClick={closeRecurringFixedStudentsModal}
                                            aria-label={t('common.close')}
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="crear-fixed-students-modal-content">
                                        <input
                                            type="text"
                                            className="crear-input crear-fixed-students-search"
                                            value={recurringFixedStudentsSearch}
                                            onChange={(e) => setRecurringFixedStudentsSearch(e.target.value)}
                                            placeholder={t('create.searchFixedStudents')}
                                        />

                                        <p className="crear-fixed-students-counter">
                                            {t('create.selectedStudents')}: {recurringFixedStudentsDraftIds.length}
                                        </p>

                                        <div className="crear-fixed-students-modal-list">
                                            {filteredFixedStudentOptions.length === 0 ? (
                                                <p className="crear-fixed-student-empty">
                                                    {recurringFixedStudentsSearch.trim()
                                                        ? t('create.noStudentsFound')
                                                        : t('create.noFixedStudentsAvailable')}
                                                </p>
                                            ) : filteredFixedStudentOptions.map((student) => {
                                                const isSelected = recurringFixedStudentsDraftIds.includes(student.id);
                                                return (
                                                    <button
                                                        key={student.id}
                                                        type="button"
                                                        className={`crear-fixed-student-option ${isSelected ? 'selected' : ''}`}
                                                        onClick={() => toggleRecurringFixedStudent(student.id)}
                                                    >
                                                        <span className="crear-fixed-student-name">{student.name}</span>
                                                        <span className="crear-fixed-student-meta">{student.email}</span>
                                                        <span className={`crear-fixed-student-check ${isSelected ? 'selected' : ''}`}>
                                                            {isSelected ? '✓' : '+'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="crear-time-picker-actions">
                                            <button type="button" className="crear-btn-primary" onClick={applyRecurringFixedStudentsSelection}>
                                                {t('common.apply')}
                                            </button>
                                            <button type="button" className="app-btn-danger" onClick={closeRecurringFixedStudentsModal}>
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </IonModal>

                            {/* Campo Nombre de la clase */}
                            <label className="crear-field-label" htmlFor="rec-class-name">{t('create.className')}</label>
                            <input
                                id="rec-class-name"
                                className="crear-input"
                                type="text"
                                value={recurringDraft.className}
                                onChange={e => setRecurringDraft(d => ({ ...d, className: e.target.value }))}
                                placeholder={t('create.recurringClassNamePlaceholder')}
                            />

                            {/* Selección de días de la semana */}
                            <div className="crear-days-row">
                                {[
                                    { label: "L", value: 1 },
                                    { label: "M", value: 2 },
                                    { label: "X", value: 3 },
                                    { label: "J", value: 4 },
                                    { label: "V", value: 5 },
                                    { label: "S", value: 6 },
                                    { label: "D", value: 0 },
                                ].map(({ label, value }) => (
                                    <label key={value} className={`crear-day-checkbox ${recurringDraft.daysOfWeek.includes(value) ? 'selected' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={recurringDraft.daysOfWeek.includes(value)}
                                            onChange={() => setRecurringDraft(draft => {
                                                let days;
                                                if (draft.daysOfWeek.includes(value)) {
                                                    days = draft.daysOfWeek.filter(day => day !== value);
                                                } else {
                                                    days = [...draft.daysOfWeek, value];
                                                }
                                                // Always keep days sorted L->D: 1,2,3,4,5,6,0
                                                const sortedDays = [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d));
                                                return { ...draft, daysOfWeek: sortedDays };
                                            })}
                                        />
                                        <span className="custom-checkbox" />
                                        <span className="crear-day-checkbox-day">{label}</span>
                                    </label>
                                ))}
                            </div>

                            {/* Fechas inicio/fin */}
                            <label className="crear-field-label" htmlFor="rec-start-date">{t('create.startDate')}</label>
                            <button
                                id="rec-start-date"
                                type="button"
                                className="crear-input crear-date-btn"
                                onClick={toggleRecurringDatePicker}
                            >
                                {formatIsoDateForUi(recurringDraft.startDate)}
                            </button>
                            {showRecurringDatePicker && (
                                <div className="crear-single-date-panel">
                                    <IonDatetime
                                        className="crear-single-date-calendar"
                                        presentation="date"
                                        firstDayOfWeek={1}
                                        locale={dateLocale}
                                        value={recurringDraft.startDate}
                                        min="2020-01-01"
                                        max="2100-12-31"
                                        isDateEnabled={(isoDate: string) => {
                                            // Solo habilita lunes
                                            const date = new Date(isoDate);
                                            return date.getDay() === 1;
                                        }}
                                        onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                            const value = e.detail.value;
                                            if (typeof value !== 'string') return;
                                            const date = new Date(value);
                                            if (date.getDay() !== 1) {
                                                // Si no es lunes, no actualiza
                                                return;
                                            }
                                            // Calcula el domingo siguiente
                                            const sunday = new Date(date);
                                            sunday.setDate(date.getDate() + 6); // lunes + 6 días = domingo
                                            const sundayIso = sunday.toISOString().slice(0, 10);
                                            setRecurringDraft(d => ({ ...d, startDate: value.slice(0, 10), endDate: sundayIso }));
                                            setShowRecurringDatePicker(false);
                                        }}
                                    />
                                </div>
                            )}
                            <label className="crear-field-label" htmlFor="rec-end-date">{t('create.endDate')}</label>
                            <input
                                id="rec-end-date"
                                className="crear-input"
                                type="date"
                                value={recurringDraft.endDate}
                                readOnly
                            />

                            {/* Hora inicio/fin con picker visual */}
                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="rec-start-time">{t('create.startTime')}</label>
                                    <button
                                        id="rec-start-time"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={() => openRecurringTimePicker('start')}
                                    >
                                        {recurringDraft.startTime || '--:--'}
                                    </button>
                                </div>
                                <div>
                                    <label className="crear-field-label" htmlFor="rec-end-time">{t('create.endTime')}</label>
                                    <button
                                        id="rec-end-time"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={() => openRecurringTimePicker('end')}
                                    >
                                        {recurringDraft.endTime || '--:--'}
                                    </button>
                                </div>
                            </div>

                            {showRecurringTimePicker ? (
                                <div className="crear-time-picker-panel" ref={recurringTimePanelRef}>
                                    <h4>{recurringTimePickerTarget === 'start' ? t('create.startTimeTitle') : t('create.endTimeTitle')}</h4>
                                    <IonDatetime
                                        className="crear-time-picker"
                                        presentation="time"
                                        preferWheel={true}
                                        minuteValues="0,30"
                                        value={recurringTimePickerValue}
                                        onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                            const nextValue = e.detail.value;
                                            if (typeof nextValue === 'string') {
                                                setRecurringTimePickerValue(nextValue);
                                            }
                                        }}
                                    />
                                    <div className="crear-time-picker-actions">
                                        <button type="button" className="crear-btn-primary" onClick={applyRecurringPickedTime}>
                                            {t('common.apply')}
                                        </button>
                                        <button type="button" className="app-btn-danger" onClick={() => { setShowRecurringTimePicker(false); setRecurringTimePickerTarget(null); }}>
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Capacidad (picker visual igual que puntual) */}
                            <label className="crear-field-label" htmlFor="rec-capacity">{t('create.capacity')}</label>
                            <button
                                id="rec-capacity"
                                type="button"
                                className="crear-input crear-date-btn"
                                onClick={toggleRecurringCapacityPicker}
                            >
                                {recurringDraft.capacity}
                            </button>

                            {showRecurringCapacityPicker ? (
                                <div className="crear-capacity-picker-panel" ref={recurringCapacityPanelRef}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={`crear-capacity-option ${recurringDraft.capacity === value ? 'selected' : ''}`}
                                            onClick={() => pickRecurringCapacity(value)}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {/* Notas */}

                            <label className="crear-field-label" htmlFor="week-rec-notes">Notas (Opcional)</label>
                            <textarea
                                id="week-rec-notes"
                                className="crear-textarea"
                                value={recurringDraft.notes}
                                onChange={e => setRecurringDraft(d => ({ ...d, notes: e.target.value }))}
                                placeholder="Añade una observación para esta clase"
                            />

                            {/* Vista previa recurrente semanal */}
                            <div className="crear-preview-card crear-single-preview">
                                <p><strong>Vista previa</strong></p>
                                <p>Clase: {recurringDraft.className.trim() || 'Sin nombre'}</p>
                                <p>Fecha inicio: {recurringDraft.startDate ? formatIsoDateForUi(recurringDraft.startDate, '/') : '-'}</p>
                                <p>Fecha fin: {recurringDraft.endDate ? formatIsoDateForUi(recurringDraft.endDate, '/') : '-'}</p>
                                <p>Días: {
                                    recurringDraft.daysOfWeek.length > 0
                                        ? [1, 2, 3, 4, 5, 6, 0]
                                            .filter(d => recurringDraft.daysOfWeek.includes(d))
                                            .map(d => ['L', 'M', 'X', 'J', 'V', 'S', 'D'][d === 0 ? 6 : d - 1])
                                            .join(', ')
                                        : '-'
                                }</p>
                                <p>Horario: {recurringDraft.startTime} - {recurringDraft.endTime}</p>
                                <p>Capacidad: {recurringDraft.capacity}</p>
                                <p>Entrenador: {recurringDraft.trainerName.trim() || 'Sin asignar'}</p>
                                <p>{t('create.fixedStudents')}: {selectedRecurringFixedStudents.length > 0 ? selectedRecurringFixedStudents.map((student) => student.name).join(', ') : t('create.noneSelected')}</p>
                            </div>

                            <div className="crear-actions-row">
                                <button
                                    type="button"
                                    className="crear-btn-secondary"
                                    onClick={() => {
                                        setRecurringDraft({
                                            className: '',
                                            startDate: getTodayIsoDate(),
                                            endDate: getTodayIsoDate(),
                                            daysOfWeek: [],
                                            startTime: '09:00',
                                            endTime: '10:00',
                                            capacity: 10,
                                            trainerId: null,
                                            trainerName: '',
                                            notes: '',
                                            fixedStudentIds: [],
                                        });
                                        closeAllRecurringSubmodals();
                                    }}
                                >
                                    Limpiar
                                </button>
                                <button
                                    type="button"
                                    className="crear-btn-primary"
                                    disabled={recurringDraft.className.trim().length === 0 || recurringDraft.trainerId === null || recurringDraft.daysOfWeek.length === 0 || recurringDraft.startTime >= recurringDraft.endTime}
                                    onClick={async () => {
                                        const start = new Date(recurringDraft.startDate);
                                        const end = new Date(recurringDraft.endDate);
                                        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
                                            setToast({
                                                show: true,
                                                message: 'Rango de fechas inválido para la recurrencia semanal.',
                                                type: 'danger',
                                            });
                                            return;
                                        }

                                        if (recurringDraft.daysOfWeek.length === 0) {
                                            setToast({
                                                show: true,
                                                message: 'Selecciona al menos un día válido en el rango.',
                                                type: 'danger',
                                            });
                                            return;
                                        }

                                        const daySpanMs = end.getTime() - start.getTime();
                                        const daySpan = Math.floor(daySpanMs / (24 * 60 * 60 * 1000)) + 1;
                                        const weeksAhead = Math.ceil(daySpan / 7);

                                        if (weeksAhead > 12) {
                                            setToast({
                                                show: true,
                                                message: 'La recurrencia semanal admite un máximo de 12 semanas.',
                                                type: 'danger',
                                            });
                                            return;
                                        }

                                        // Backend usa 0=lunes ... 6=domingo, mientras la UI usa 0=domingo ... 6=sábado.
                                        const backendDays = recurringDraft.daysOfWeek.map((day) => (day === 0 ? 6 : day - 1));

                                        try {
                                            await Promise.all(
                                                backendDays.map((backendDay) => createWeeklySchedule({
                                                    trainer_id: recurringDraft.trainerId as number,
                                                    day_of_week: backendDay,
                                                    start_time: recurringDraft.startTime,
                                                    end_time: recurringDraft.endTime,
                                                    capacity: recurringDraft.capacity,
                                                    class_name: recurringDraft.className.trim(),
                                                    notes: recurringDraft.notes.trim() || undefined,
                                                    fixed_student_ids: recurringDraft.fixedStudentIds,
                                                    weeks_ahead: Math.max(1, weeksAhead),
                                                    start_date: recurringDraft.startDate,
                                                }))
                                            );
                                            setToast({
                                                show: true,
                                                message: '✓ Clases recurrentes creadas exitosamente',
                                                type: 'success',
                                            });
                                            setTimeout(() => {
                                                setShowRecurringModal(false);
                                                setRecurringDraft({
                                                    className: '',
                                                    startDate: getTodayIsoDate(),
                                                    endDate: getTodayIsoDate(),
                                                    daysOfWeek: [],
                                                    startTime: '09:00',
                                                    endTime: '10:00',
                                                    capacity: 10,
                                                    trainerId: null,
                                                    trainerName: '',
                                                    notes: '',
                                                    fixedStudentIds: [],
                                                });
                                                closeAllRecurringSubmodals();
                                            }, 1000);
                                        } catch (error: any) {
                                            setToast({
                                                show: true,
                                                message: `Error: ${error.message || 'No se pudieron crear las clases'}`,
                                                type: 'danger',
                                            });
                                        }
                                    }}
                                >
                                    Continuar
                                </button>
                            </div>
                            {/* Botón para abrir el modal de copiar semana (ahora abajo) */}
                            <div className="crear-copy-week-btn-row">
                                <button
                                    type="button"
                                    className="crear-btn-primary crear-copy-week-btn"
                                    onClick={() => setShowCopyWeekModal(true)}
                                >
                                    Copiar semana anterior
                                </button>
                            </div>
                        </form>
                    </div>
                </IonModal>
                <CustomToast
                    show={toast.show}
                    message={toast.message}
                    onClose={() => setToast((prev) => ({ ...prev, show: false }))}
                    type={toast.type}
                    duration={3000}
                />
            </div>
        </div>
    );
};

export default CrearForm;


