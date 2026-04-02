import { useState } from 'react';
import './CrearForm.css';

type CreateMode = 'single' | 'recurring' | null;

type RecurrenceMode = 'weekly' | 'monthly';

const CrearForm: React.FC = () => {
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('weekly');

  return (
    <div className="crear-form-container">
      <div className="crear-top-bar">
        <div className="crear-top-title">Crear</div>
      </div>

      <div className="crear-form-content">
        <section className="crear-form-hero">
          <h1 className="crear-form-title">Nueva creación</h1>
          <p className="crear-form-subtitle">
            Aquí Alex podrá crear una clase puntual o configurar una recurrencia semanal o mensual.
          </p>
        </section>

        <section className="crear-form-section">
          <h2 className="crear-form-section-title">Qué quieres crear</h2>
          <div className="crear-mode-grid">
            <button
              type="button"
              className={`crear-mode-card ${createMode === 'single' ? 'selected' : ''}`}
              onClick={() => setCreateMode('single')}
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
      </div>
    </div>
  );
};

export default CrearForm;
