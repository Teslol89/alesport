import { useState } from 'react';
import { IonDatetime, IonModal } from '@ionic/react';
import './CrearForm.css';

type CreateMode = 'single' | 'recurring' | null;

type RecurrenceMode = 'weekly' | 'monthly';

type SingleSessionDraft = {
    className: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
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

const CrearForm: React.FC = () => {
    const [createMode, setCreateMode] = useState<CreateMode>(null);
    const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('weekly');
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [showSingleDatePicker, setShowSingleDatePicker] = useState(false);
    const [submitInfo, setSubmitInfo] = useState<string | null>(null);
    const [singleDraft, setSingleDraft] = useState<SingleSessionDraft>({
        className: '',
        sessionDate: toTodayIsoDate(),
        startTime: '09:00',
        endTime: '10:00',
        capacity: 10,
        trainerName: 'Alex',
        notes: '',
    });

    const isSingleTimeRangeValid = singleDraft.startTime < singleDraft.endTime;
    const isSingleCapacityValid = singleDraft.capacity >= 1 && singleDraft.capacity <= 10;
    const isSingleRequiredValid = singleDraft.className.trim().length > 0 && singleDraft.sessionDate.length > 0;
    const isSingleValid = isSingleTimeRangeValid && isSingleCapacityValid && isSingleRequiredValid;

    function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!isSingleValid) {
            setSubmitInfo('Revisa los campos obligatorios y el rango de horas antes de continuar.');
            return;
        }
        setSubmitInfo('Formulario de clase puntual correcto. En el siguiente paso lo conectamos con el endpoint de creación.');
    }

    function resetSingleDraft() {
        setSingleDraft({
            className: '',
            sessionDate: toTodayIsoDate(),
            startTime: '09:00',
            endTime: '10:00',
            capacity: 10,
            trainerName: 'Alex',
            notes: '',
        });
        setSubmitInfo(null);
    }

    return (
        <div className="crear-form-container">
            <div className="crear-top-bar">
                <div className="crear-top-title">Crear</div>
            </div>

            <div className="crear-form-content">

                {/* Explicación general y elección de modo */}
                <section className="crear-form-hero">
                    <h1 className="crear-form-title">Nueva creación</h1>
                    <p className="crear-form-subtitle">
                        Aquí Alex podrá crear una clase puntual o configurar una recurrencia semanal o mensual.
                    </p>
                </section>

                {/* Elección de clase puntual o recurrente */}
                <section className="crear-form-section">
                    <h2 className="crear-form-section-title">Qué quieres crear</h2>
                    <div className="crear-mode-grid">
                        <button
                            type="button"
                            className={`crear-mode-card ${createMode === 'single' ? 'selected' : ''}`}
                            onClick={() => {
                                setCreateMode('single');
                                setSubmitInfo(null);
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
                    onDidDismiss={() => setShowSingleModal(false)}
                >
                    <div className="crear-single-modal">
                        <div className="crear-single-modal-header">
                            <h3>Crear clase puntual</h3>
                            <button
                                type="button"
                                className="crear-single-modal-close"
                                onClick={() => setShowSingleModal(false)}
                                aria-label="Cerrar"
                            >
                                ×
                            </button>
                        </div>

                        <form className="crear-single-form" onSubmit={handleSingleSubmit}>
                            <label className="crear-field-label" htmlFor="single-class-name">Nombre de la clase</label>
                            <input
                                id="single-class-name"
                                className="crear-input"
                                type="text"
                                value={singleDraft.className}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, className: e.target.value }))}
                                placeholder="Ej: Funcional Intermedio"
                            />

                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="single-session-date-btn">Fecha</label>
                                    <button
                                        id="single-session-date-btn"
                                        type="button"
                                        className="crear-input crear-date-btn"
                                        onClick={() => setShowSingleDatePicker((prev) => !prev)}
                                    >
                                        {formatIsoDateForUi(singleDraft.sessionDate)}
                                    </button>

                                    {showSingleDatePicker ? (
                                        <div className="crear-single-date-panel">
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
                                                    className="crear-btn-secondary"
                                                    onClick={() => setShowSingleDatePicker(false)}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="crear-btn-primary"
                                                    onClick={() => setShowSingleDatePicker(false)}
                                                >
                                                    Aceptar
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div>
                                    <label className="crear-field-label" htmlFor="single-capacity">Capacidad (1-10)</label>
                                    <input
                                        id="single-capacity"
                                        className="crear-input"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={singleDraft.capacity}
                                        onChange={(e) => setSingleDraft((prev) => ({ ...prev, capacity: Number(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            <div className="crear-field-grid">
                                <div>
                                    <label className="crear-field-label" htmlFor="single-start-time">Hora inicio</label>
                                    <input
                                        id="single-start-time"
                                        className="crear-input"
                                        type="time"
                                        step={1800}
                                        value={singleDraft.startTime}
                                        onChange={(e) => setSingleDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="crear-field-label" htmlFor="single-end-time">Hora fin</label>
                                    <input
                                        id="single-end-time"
                                        className="crear-input"
                                        type="time"
                                        step={1800}
                                        value={singleDraft.endTime}
                                        onChange={(e) => setSingleDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <label className="crear-field-label" htmlFor="single-trainer-name">Entrenador</label>
                            <input
                                id="single-trainer-name"
                                className="crear-input"
                                type="text"
                                value={singleDraft.trainerName}
                                onChange={(e) => setSingleDraft((prev) => ({ ...prev, trainerName: e.target.value }))}
                                placeholder="Nombre del entrenador"
                            />

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
