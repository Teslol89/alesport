import React, { useState } from "react";
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
    <div className="forgot-password-container" style={{ position: 'relative' }}>
      <button
        className="fp-back-btn"
        type="button"
        aria-label="Volver"
        onClick={() => history.goBack()}
      >
        <img src={atrasIcon} alt="Atrás" className="fp-back-icon" />
      </button>
      <h2 className="forgot-password-title">Nueva contraseña</h2>
      <p className="forgot-password-description">Introduce tu nueva contraseña para {email && <b>{email}</b>}.</p>
      <form onSubmit={handleSubmit}>
        <input
          className="forgot-password-input"
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          className="forgot-password-input"
          type="password"
          placeholder="Repite la contraseña"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
        />
        <button className="forgot-password-btn" type="submit" disabled={loading}>
          {loading ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
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
