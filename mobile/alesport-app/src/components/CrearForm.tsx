/* =================== TIPOS Y CONSTANTES =================== */
import logoIcon from '../icons/icon.png';
import { useEffect, useRef, useState } from 'react';
import { IonDatetime, IonModal } from '@ionic/react';
import { getAssignableTrainers, type AssignableTrainer } from '../api/user';
import { createSingleSession, createRecurringSessions } from '../api/sessions';
import { copyWeekSessions } from '../api/sessions';
import { formatIsoDateForUi, fromPickerTimeIso, getTodayIsoDate, toPickerTimeIso, getMondayOfWeek, getSundayOfWeek } from '../utils/funcionesGeneral';
import CustomToast from './CustomStyles';
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
};

/* Fecha base para el time picker, que solo maneja horas y minutos.
Se usará una fecha fija y se ignorará al aplicar la hora seleccionada. */
const TIME_PICKER_BASE_DATE = '1970-01-01';

/* Componente principal para el formulario de creación,
 que incluye la elección entre clase puntual o recurrente,
  y el formulario específico para clase puntual en un modal. */
const CrearForm: React.FC = () => {
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
        setShowRecurringTrainerPicker(false);
        setShowRecurringDatePicker(false);
        setTimeout(() => {
            const currentValue = target === 'start' ? recurringDraft.startTime : recurringDraft.endTime;
            const normalizedValue = currentValue ? currentValue.slice(0, 5) : '09:00';
            setRecurringTimePickerTarget(target);
            setRecurringTimePickerValue(toPickerTimeIso(normalizedValue, TIME_PICKER_BASE_DATE));
            setShowRecurringTimePicker(true);
        }, 10);
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
    const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
    const [trainersError, setTrainersError] = useState<string | null>(null);
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
    });

    // --- Lógica del picker de entrenador recurrente ---
    // (Agrupada aquí para claridad, cerca del modal recurrente)
    const [showRecurringTrainerPicker, setShowRecurringTrainerPicker] = useState(false);
    const recurringTrainerPanelRef = useRef<HTMLDivElement | null>(null);

    // Estado para mostrar/ocultar el date picker y capacity picker recurrente semanal
    const [showRecurringDatePicker, setShowRecurringDatePicker] = useState(false);
    const [showRecurringCapacityPicker, setShowRecurringCapacityPicker] = useState(false);
    const recurringCapacityPanelRef = useRef<HTMLDivElement | null>(null);

    // Cierra todos los submodales de la clase recurrente semanal
    function closeAllRecurringSubmodals() {
        setShowRecurringTrainerPicker(false);
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

    function toggleRecurringTrainerPicker() {
        setShowRecurringDatePicker(false);
        setShowRecurringTimePicker(false);
        setTimeout(() => {
            setShowRecurringTrainerPicker(true);
        }, 10);
    }

    function pickRecurringTrainer(trainer: AssignableTrainer) {
        setRecurringDraft((prev) => ({ ...prev, trainerId: trainer.id, trainerName: trainer.name }));
        setShowRecurringTrainerPicker(false);
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
        setTimeout(() => {
            setShowRecurringDatePicker(true);
            setTimeout(() => {
                const panel = document.querySelector('.crear-single-date-panel');
                if (panel && recurringModalBodyRef.current) {
                    scrollRecurringSubpanelIntoView(panel as HTMLDivElement);
                }
            }, 50);
        }, 10);
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

        async function loadAssignableTrainers() {
            setIsLoadingTrainers(true);
            setTrainersError(null);

            try {
                const options = await getAssignableTrainers();
                if (cancelled) {
                    return;
                }
                setTrainerOptions(options);
                // Ya no asignamos entrenador por defecto
            } catch {
                if (!cancelled) {
                    setTrainersError('No se pudieron cargar los entrenadores.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoadingTrainers(false);
                }
            }
        }

        loadAssignableTrainers();

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
        <div className="crear-form-container">
            <div className="crear-top-bar">
                <img src={logoIcon} alt="Logo gimnasio" className="crear-top-logo" />
                <div className="crear-top-title crear-top-title-absolute">Crear clases</div>
            </div>

            <div className="crear-form-content">

                {/* Elección de clase puntual o recurrente */}
                <section className="crear-form-section">
                    <h2 className="crear-form-section-title">¿Qué quieres hacer?</h2>
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
                            <span className="crear-mode-card-kicker">Opción 1</span>
                            <span className="crear-mode-card-title">Clase puntual</span>
                            <span className="crear-mode-card-text">
                                Para una sesión concreta en una fecha y hora determinadas.
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
                            <span className="crear-mode-card-kicker">Opción 2</span>
                            <span className="crear-mode-card-title">Horario recurrente</span>
                            <span className="crear-mode-card-text">
                                Para generar clases repetidas con patrón semanal o mensual.
                            </span>
                        </button>
                    </div>
                </section>

                {createMode === 'recurring' && (
                    <section className="crear-form-section">
                        <h2 className="crear-form-section-title">¿Qué frecuencia quieres?</h2>
                        <div className="crear-frequency-row">
                            <button
                                type="button"
                                className={`crear-frequency-pill${recurrenceMode === 'weekly' ? ' selected' : ''}`}
                                onClick={() => {
                                    setRecurrenceMode('weekly');
                                    setShowRecurringModal(true);
                                }}
                            >
                                Semanal
                            </button>
                            <button
                                type="button"
                                className={`crear-frequency-pill${recurrenceMode === 'monthly' ? ' selected' : ''}`}
                                onClick={() => {
                                    setRecurrenceMode('monthly');
                                    // Aquí puedes abrir el modal mensual cuando lo implementes
                                }}
                            >
                                Mensual
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
                            <h3>Crear clase puntual</h3>
                            <button
                                type="button"
                                className="crear-single-modal-close"
                                onClick={() => {
                                    setShowSingleModal(false);
                                    closeAllSingleSubmodals();
                                }}
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        <form className="crear-single-form" onSubmit={handleSingleSubmit} onClick={closeSubmodalsOnEmptyClick}>

                            {/* Campo Entrenador */}
                            <label className="crear-field-label" htmlFor="single-trainer-role">Entrenador</label>
                            <button
                                id="single-trainer-role"
                                type="button"
                                className="crear-input crear-date-btn"
                                disabled={isLoadingTrainers || trainerOptions.length === 0}
                                onClick={toggleTrainerPicker}
                            >
                                {isLoadingTrainers ? 'Cargando entrenadores...' : (singleDraft.trainerName || 'Selecciona entrenador')}
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
                            <label className="crear-field-label" htmlFor="single-class-name">Nombre de la clase</label>
                            <input
                                id="single-class-name"
                                className="crear-input"
                                type="text"
                                value={singleDraft.className}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, className: e.target.value }))}
                                placeholder="Ej: Fuerza, Spinning..."
                            />

                            {/* Campo Fecha */}
                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="single-session-date-btn">Fecha</label>
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
                                                locale="es-ES"
                                                value={singleDraft.sessionDate}
                                                onIonChange={(e: CustomEvent<{ value?: string | string[] | null }>) => {
                                                    const next = e.detail.value;
                                                    if (typeof next === 'string') {
                                                        setSingleDraft((prev) => ({ ...prev, sessionDate: next.slice(0, 10) }));
                                                    }
                                                }}
                                            />

                                            <div className="crear-single-date-modal-actions">
                                                <button
                                                    type="button"
                                                    className="crear-btn-primary"
                                                    onClick={closeAllSingleSubmodals}
                                                >
                                                    Aceptar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="app-btn-danger"
                                                    onClick={closeAllSingleSubmodals}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Campo Capacidad */}
                                <div>
                                    <label className="crear-field-label" htmlFor="single-capacity">Capacidad (1-10)</label>
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
                                    <label className="crear-field-label" htmlFor="single-start-time">Hora inicio</label>
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
                                    <label className="crear-field-label" htmlFor="single-end-time">Hora fin</label>
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
                                    <h4>{timePickerTarget === 'start' ? 'Hora de inicio' : 'Hora de fin'}</h4>
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
                                            Aplicar
                                        </button>
                                        <button type="button" className="app-btn-danger" onClick={closeAllSingleSubmodals}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Campo Notas */}
                            <label className="crear-field-label" htmlFor="single-notes">Notas (opcional)</label>
                            <textarea
                                id="single-notes"
                                className="crear-textarea"
                                value={singleDraft.notes}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Añade una observación para esta clase"
                            />

                            {!isSingleTimeRangeValid ? (
                                <p className="crear-validation-error">La hora de inicio debe ser anterior a la de fin.</p>
                            ) : null}

                            {!isSingleCapacityValid ? (
                                <p className="crear-validation-error">La capacidad debe estar entre 1 y 10.</p>
                            ) : null}

                            {!isSingleTrainerValid ? (
                                <p className="crear-validation-error">Debes seleccionar un entrenador válido.</p>
                            ) : null}

                            <div className="crear-preview-card crear-single-preview">
                                <p><strong>Vista previa</strong></p>
                                <p>Clase: {singleDraft.className.trim() || 'Sin nombre'}</p>
                                <p>Fecha: {singleDraft.sessionDate ? formatIsoDateForUi(singleDraft.sessionDate, '/') : '-'}</p>
                                <p>Horario: {singleDraft.startTime} - {singleDraft.endTime}</p>
                                <p>Capacidad: {singleDraft.capacity}</p>
                                <p>Entrenador: {singleDraft.trainerName.trim() || 'Sin asignar'}</p>
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
                                    Limpiar
                                </button>
                                <button type="submit" className="crear-btn-primary" disabled={!isSingleValid}>
                                    Continuar
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
                        setShowRecurringTrainerPicker(false);
                    }}
                >
                    <div className="crear-single-modal" onClick={closeRecurringSubmodalsOnEmptyClick} ref={recurringModalBodyRef}>
                        <div className="crear-single-modal-header">
                            <h3>Crear clase recurrente semanal</h3>
                            <button
                                type="button"
                                className="crear-single-modal-close"
                                onClick={() => {
                                    setShowRecurringModal(false);
                                    setShowRecurringTrainerPicker(false);
                                }}
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>
                        <form className="crear-single-form">
                            {/* Botón para abrir el modal de copiar semana */}
                            <div className="crear-copy-week-btn-row">
                                <button
                                    type="button"
                                    className="crear-btn-primary crear-copy-week-btn"
                                    onClick={() => setShowCopyWeekModal(true)}
                                >
                                    Copiar semana anterior
                                </button>
                            </div>

                            {/* Modal de copiar semana: permite elegir semana origen y destino */}
                            <IonModal
                                className="crear-single-modal-wrapper"
                                isOpen={showCopyWeekModal}
                                onDidDismiss={() => setShowCopyWeekModal(false)}
                                backdropDismiss={true}
                            >
                                <div className="crear-single-modal">
                                    <h3 className="crear-copy-week-title">Copiar semana</h3>
                                    <form className="crear-single-form" onSubmit={e => { e.preventDefault(); handleCopyWeek(); }}>
                                        <div className="crear-copy-week-row">
                                            <label className="crear-field-label">Semana a copiar (origen)</label>
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
                                                        locale="es-ES"
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
                                                                if (d.getDay() === 1) setCopyWeekSource(value.slice(0, 10));
                                                            }
                                                        }}
                                                    />
                                                    <div className="crear-single-date-modal-actions">
                                                        <button type="button" className="crear-btn-primary" onClick={() => setShowSourcePicker(false)}>Aceptar</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="crear-copy-week-row">
                                            <label className="crear-field-label">Semana destino</label>
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
                                                        locale="es-ES"
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
                                                                if (d.getDay() === 1) setCopyWeekTarget(value.slice(0, 10));
                                                            }
                                                        }}
                                                    />
                                                    <div className="crear-single-date-modal-actions">
                                                        <button type="button" className="crear-btn-primary" onClick={() => setShowTargetPicker(false)}>Aceptar</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="crear-actions-row">
                                            <button
                                                type="submit"
                                                className="crear-btn-primary"
                                                disabled={!copyWeekSource || !copyWeekTarget}
                                            >
                                                Copiar
                                            </button>
                                            <button
                                                type="button"
                                                className="app-btn-danger"
                                                onClick={() => setShowCopyWeekModal(false)}
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </IonModal>
                            {/* Campo Entrenador */}
                            <label className="crear-field-label" htmlFor="rec-trainer-role">Entrenador</label>
                            <button
                                id="rec-trainer-role"
                                type="button"
                                className="crear-input crear-date-btn"
                                disabled={isLoadingTrainers || trainerOptions.length === 0}
                                onClick={toggleRecurringTrainerPicker}
                            >
                                {isLoadingTrainers ? 'Cargando entrenadores...' : (recurringDraft.trainerName || 'Selecciona entrenador')}
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

                            {/* Campo Nombre de la clase */}
                            <label className="crear-field-label" htmlFor="rec-class-name">Nombre de la clase</label>
                            <input
                                id="rec-class-name"
                                className="crear-input"
                                type="text"
                                value={recurringDraft.className}
                                onChange={e => setRecurringDraft(d => ({ ...d, className: e.target.value }))}
                                placeholder="Ej: Yoga, Pilates..."
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
                            <label className="crear-field-label" htmlFor="rec-start-date">Fecha inicio (lunes)</label>
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
                                        locale="es-ES"
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
                                    <div className="crear-single-date-modal-actions">
                                        <button type="button" className="crear-btn-primary" onClick={() => setShowRecurringDatePicker(false)}>Cancelar</button>
                                    </div>
                                </div>
                            )}
                            <label className="crear-field-label" htmlFor="rec-end-date">Fecha fin (domingo)</label>
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
                                    <label className="crear-field-label" htmlFor="rec-start-time">Hora inicio</label>
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
                                    <label className="crear-field-label" htmlFor="rec-end-time">Hora fin</label>
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
                                    <h4>{recurringTimePickerTarget === 'start' ? 'Hora de inicio' : 'Hora de fin'}</h4>
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
                                            Aplicar
                                        </button>
                                        <button type="button" className="app-btn-danger" onClick={() => { setShowRecurringTimePicker(false); setRecurringTimePickerTarget(null); }}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Capacidad (picker visual igual que puntual) */}
                            <label className="crear-field-label" htmlFor="rec-capacity">Capacidad (1-10)</label>
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
                                        // Generar todas las fechas de la recurrencia semanal
                                        const start = new Date(recurringDraft.startDate);
                                        const end = new Date(recurringDraft.endDate);
                                        const sessions = [];
                                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                            // d.getDay(): 0=Dom, 1=Lun, ..., 6=Sab
                                            // Our daysOfWeek: [1,2,3,4,5,6,0] (L->D)
                                            const jsDay = d.getDay();
                                            const mappedDay = jsDay === 0 ? 0 : jsDay; // 0=Domingo, 1=Lunes...
                                            if (recurringDraft.daysOfWeek.includes(mappedDay)) {
                                                sessions.push({
                                                    session_date: d.toISOString().slice(0, 10),
                                                    start_time: recurringDraft.startTime,
                                                    end_time: recurringDraft.endTime,
                                                    capacity: recurringDraft.capacity,
                                                    class_name: recurringDraft.className.trim(),
                                                    notes: recurringDraft.notes.trim() || undefined,
                                                    trainer_id: recurringDraft.trainerId || undefined,
                                                });
                                            }
                                        }
                                        if (sessions.length === 0) {
                                            setToast({
                                                show: true,
                                                message: 'Selecciona al menos un día válido en el rango.',
                                                type: 'danger',
                                            });
                                            return;
                                        }
                                        try {
                                            await createRecurringSessions(sessions);
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


