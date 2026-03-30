import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomStyles";
import "./ForgotPasswordVerifyForm.css";
import atrasIcon from "../icons/atras.svg";


const ForgotPasswordVerifyForm: React.FC = () => {
  const history = useHistory();
  const [email] = useState(() => localStorage.getItem("pendingPasswordResetEmail") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "danger" }>({ show: false, message: "", type: "success" });

  React.useEffect(() => {
    if (!email) {
      setToast({ show: true, message: "Debes iniciar el proceso de recuperación desde el principio.", type: "danger" });
      setTimeout(() => history.replace("/"), 2000);
    }
  }, [email, history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast({ show: false, message: "", type: "success" });
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${apiUrl}/auth/verify-password-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ show: true, message: "Código verificado. Ahora puedes cambiar tu contraseña.", type: "success" });
        localStorage.setItem("pendingPasswordResetCode", code);
        // Aquí deberías redirigir a la página de nueva contraseña
      } else {
        setToast({ show: true, message: data.detail || "Código incorrecto", type: "danger" });
      }
    } catch {
      setToast({ show: true, message: "Error de red o servidor", type: "danger" });
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="fpverify-container" style={{ position: 'relative', textAlign: 'center', padding: '48px' }}>
        <p>Redirigiendo al inicio del proceso de recuperación...</p>
        <CustomToast
          show={toast.show}
          message={toast.message}
          onClose={() => setToast({ ...toast, show: false })}
          type={toast.type}
          duration={3000}
        />
      </div>
    );
  }

  return (
    <div className="fpverify-container" style={{ position: 'relative' }}>
      <button
        className="fp-back-btn"
        type="button"
        aria-label="Volver"
        onClick={() => history.goBack()}
      >
        <img src={atrasIcon} alt="Atrás" className="fp-back-icon" />
      </button>
      <h2 className="fpverify-title">Verificar OTP</h2>
      <p className="fpverify-description">
        Hemos enviado un código a <b>{email}</b>.<br />Introdúcelo para continuar.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          className="fpverify-input"
          type="text"
          placeholder="Código de verificación"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          required
          maxLength={6}
          inputMode="text"
        />
        <button className="fpverify-btn" type="submit" disabled={loading}>
          {loading ? "Verificando..." : "Verificar código"}
        </button>
      </form>
      <div className="fp-steps-indicator">
        <span className="fp-step">―</span>
        <span className="fp-step fp-step-active">―</span>
        <span className="fp-step">―</span>
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

export default ForgotPasswordVerifyForm;
