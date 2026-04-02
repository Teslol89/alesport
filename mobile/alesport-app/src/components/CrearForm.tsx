import { useEffect, useRef, useState } from 'react';
import { IonDatetime, IonModal } from '@ionic/react';
import { getAssignableTrainers, type AssignableTrainer } from '../api/user';
import { createSingleSession } from '../api/sessions';
import './CrearForm.css';

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

function toTodayIsoDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function formatIsoDateForUi(isoDate: string) {
    if (!isoDate || isoDate.length < 10) {
        return '-- / -- / ----';
    }
    const [yyyy, mm, dd] = isoDate.slice(0, 10).split('-');
    return `${dd} / ${mm} / ${yyyy}`;
}

const TIME_PICKER_BASE_DATE = '1970-01-01';

function toPickerIso(hourValue: string) {
    return `${TIME_PICKER_BASE_DATE}T${hourValue}:00`;
}

function fromPickerIsoToHm(isoValue: string) {
    const time = isoValue.includes('T') ? isoValue.split('T')[1] : '';
    if (!time || time.length < 5) {
        return '';
    }
    return time.slice(0, 5);
}

const CrearForm: React.FC = () => {
    const [createMode, setCreateMode] = useState<CreateMode>(null);
    const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('weekly');
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [showSingleDatePicker, setShowSingleDatePicker] = useState(false);
    const [showSingleTimePicker, setShowSingleTimePicker] = useState(false);
    const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
    const [timePickerValue, setTimePickerValue] = useState(toPickerIso('09:00'));
    const [showCapacityPicker, setShowCapacityPicker] = useState(false);
    const [showTrainerPicker, setShowTrainerPicker] = useState(false);
    const [trainerOptions, setTrainerOptions] = useState<AssignableTrainer[]>([]);
    const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
    const [trainersError, setTrainersError] = useState<string | null>(null);
    const [submitInfo, setSubmitInfo] = useState<string | null>(null);
    const singleModalBodyRef = useRef<HTMLDivElement | null>(null);
    const singleDatePanelRef = useRef<HTMLDivElement | null>(null);
    const singleCapacityPanelRef = useRef<HTMLDivElement | null>(null);
    const singleTrainerPanelRef = useRef<HTMLDivElement | null>(null);
    const singleTimePanelRef = useRef<HTMLDivElement | null>(null);
    const [singleDraft, setSingleDraft] = useState<SingleSessionDraft>({
        className: '',
        sessionDate: toTodayIsoDate(),
        startTime: '09:00',
        endTime: '10:00',
        capacity: 10,
        trainerId: null,
        trainerName: '',
        notes: '',
    });

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
                if (options.length > 0) {
                    setSingleDraft((prev) => {
                        if (prev.trainerId !== null) {
                            return prev;
                        }
                        return {
                            ...prev,
                            trainerId: options[0].id,
                            trainerName: options[0].name,
                        };
                    });
                }
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
            setSubmitInfo('Revisa los campos obligatorios y el rango de horas antes de continuar.');
            return;
        }

        setSubmitInfo('Enviando sesión...');

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
                setSubmitInfo('✓ Sesión creada exitosamente');
                setTimeout(() => {
                    setShowSingleModal(false);
                    resetSingleDraft();
                }, 1000);
            })
            .catch((error) => {
                setSubmitInfo(`Error: ${error.message || 'No se pudo crear la sesión'}`);
            });
    }

    function resetSingleDraft() {
        const defaultTrainer = trainerOptions[0];
        setSingleDraft({
            className: '',
            sessionDate: toTodayIsoDate(),
            startTime: '09:00',
            endTime: '10:00',
            capacity: 10,
            trainerId: defaultTrainer?.id ?? null,
            trainerName: defaultTrainer?.name ?? '',
            notes: '',
        });
        setSubmitInfo(null);
        closeAllSingleSubmodals();
    }

    function openTimePicker(target: 'start' | 'end') {
        const currentValue = target === 'start' ? singleDraft.startTime : singleDraft.endTime;
        const normalizedValue = currentValue ? currentValue.slice(0, 5) : '09:00';
        closeAllSingleSubmodals();
        setTimePickerTarget(target);
        setTimePickerValue(toPickerIso(normalizedValue));
        setShowSingleTimePicker(true);
    }

    function applyPickedTime() {
        const hmValue = fromPickerIsoToHm(timePickerValue);
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

    return (
        <div className="crear-form-container">
            <div className="crear-top-bar">
                <div className="crear-top-title">Crear</div>
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
                                setCreateMode('single');
                                setSubmitInfo(null);
                                closeAllSingleSubmodals();
                                setShowSingleModal(true);
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
                            onClick={() => setCreateMode('recurring')}
                        >
                            <span className="crear-mode-card-kicker">Opción 2</span>
                            <span className="crear-mode-card-title">Horario recurrente</span>
                            <span className="crear-mode-card-text">
                                Para generar clases repetidas con patrón semanal o mensual.
                            </span>
                        </button>
                    </div>
                </section>

                {createMode === 'recurring' ? (
                    <section className="crear-form-section">
                        <h2 className="crear-form-section-title">Frecuencia</h2>
                        <div className="crear-frequency-row">
                            <button
                                type="button"
                                className={`crear-frequency-pill ${recurrenceMode === 'weekly' ? 'selected' : ''}`}
                                onClick={() => setRecurrenceMode('weekly')}
                            >
                                Semanal
                            </button>
                            <button
                                type="button"
                                className={`crear-frequency-pill ${recurrenceMode === 'monthly' ? 'selected' : ''}`}
                                onClick={() => setRecurrenceMode('monthly')}
                            >
                                Mensual
                            </button>
                        </div>
                    </section>
                ) : null}

                {createMode === 'single' ? (
                    <section className="crear-form-section">
                        <h2 className="crear-form-section-title">Clase puntual</h2>
                        <div className="crear-preview-card">
                            <p>El formulario de clase puntual se abre en modal para trabajar centrado y sin tanto scroll.</p>
                        </div>
                    </section>
                ) : null}

                <section className="crear-form-section crear-form-section-preview">
                    <h2 className="crear-form-section-title">Siguiente paso</h2>
                    <div className="crear-preview-card">
                        {createMode === null ? (
                            <p>Primero elige si quieres crear una clase puntual o un horario recurrente.</p>
                        ) : createMode === 'single' ? (
                            <p>
                                El siguiente bloque será el formulario de clase puntual: fecha, hora inicio, hora fin, capacidad y entrenador.
                            </p>
                        ) : (
                            <p>
                                El siguiente bloque será el formulario de recurrencia {recurrenceMode === 'weekly' ? 'semanal' : 'mensual'}, con vista previa de sesiones generadas.
                            </p>
                        )}
                    </div>
                </section>

                <IonModal
                    className="crear-single-modal-wrapper"
                    isOpen={showSingleModal}
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
                                <p>Fecha: {singleDraft.sessionDate || '-'}</p>
                                <p>Horario: {singleDraft.startTime} - {singleDraft.endTime}</p>
                                <p>Capacidad: {singleDraft.capacity}</p>
                                <p>Entrenador: {singleDraft.trainerName.trim() || 'Sin asignar'}</p>
                            </div>

                            {submitInfo ? <p className="crear-submit-info">{submitInfo}</p> : null}

                            <div className="crear-actions-row">
                                <button type="button" className="crear-btn-secondary" onClick={resetSingleDraft}>
                                    Limpiar
                                </button>
                                <button type="submit" className="crear-btn-primary" disabled={!isSingleValid}>
                                    Continuar
                                </button>
                            </div>
                        </form>
                    </div>
                </IonModal>
            </div>
        </div>
    );
};

export default CrearForm;
