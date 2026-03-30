import React, { useState } from "react";
import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomStyles";
import "./ForgotPasswordResetForm.css";
import atrasIcon from "../icons/atras.svg";

const ForgotPasswordResetForm: React.FC = () => {
  const history = useHistory();
  const [email] = useState(() => localStorage.getItem("pendingPasswordResetEmail") || "");
  const [code] = useState(() => localStorage.getItem("pendingPasswordResetCode") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "danger" }>({ show: false, message: "", type: "success" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setToast({ show: true, message: "Las contraseñas no coinciden", type: "danger" });
      return;
    }
    setLoading(true);
    setToast({ show: false, message: "", type: "success" });
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ show: true, message: "Contraseña cambiada con éxito. Ya puedes iniciar sesión.", type: "success" });
        localStorage.removeItem("pendingPasswordResetEmail");
        localStorage.removeItem("pendingPasswordResetCode");
        // Aquí deberías redirigir a login tras unos segundos
      } else {
        setToast({ show: true, message: data.detail || "No se pudo cambiar la contraseña", type: "danger" });
      }
    } catch {
      setToast({ show: true, message: "Error de red o servidor", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fpreset-container" style={{ position: 'relative' }}>
      <button
        className="fp-back-btn"
        type="button"
        aria-label="Volver"
        onClick={() => history.goBack()}
      >
        <img src={atrasIcon} alt="Atrás" className="fp-back-icon" />
      </button>
      <h2 className="fpreset-title">Nueva <br /> contraseña</h2>
      <p className="fpreset-description">Si recuerdas tu contraseña actual, retrocede sin aplicar cambios.</p>
      <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="fpreset-input"
            type={showPassword ? "text" : "password"}
            placeholder="Nueva contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="toggle-password-reset"
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword(v => !v)}
          >
            <img src={showPassword ? ojoAbierto : ojoCerrado} alt={showPassword ? "Ocultar" : "Mostrar"} />
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            className="fpreset-input"
            type={showConfirm ? "text" : "password"}
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
          />
          <button
            type="button"
            className="toggle-password-reset"
            tabIndex={-1}
            aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowConfirm(v => !v)}
          >
            <img src={showConfirm ? ojoAbierto : ojoCerrado} alt={showConfirm ? "Ocultar" : "Mostrar"} />
          </button>
        </div>
        <button className="fpreset-btn" type="submit" disabled={loading}>
          {loading ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
      <div className="fp-steps-indicator">
        <span className="fp-step">―</span>
        <span className="fp-step">―</span>
        <span className="fp-step fp-step-active">―</span>
      </div>
      <CustomToast
        show={toast.show}
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
        type={toast.type}
        duration={3000}
      />
    </div>
  );
};

export default ForgotPasswordResetForm;
