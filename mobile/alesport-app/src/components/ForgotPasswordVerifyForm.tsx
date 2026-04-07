import React, { useState, useRef, useEffect } from "react";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomStyles";
import "./ForgotPasswordVerifyForm.css";
import atrasIcon from "../icons/atras.svg";


const ForgotPasswordVerifyForm: React.FC = () => {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Función para reenviar el código con temporizador
  const handleResend = async () => {
    if (resending || resendTimer > 0) return; // Protección extra
    setResending(true);
    setResent(false);
    setToast({ show: false, message: '', type: 'success' });
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${apiUrl}/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setToast({ show: true, message: "Código reenviado. Revisa tu correo.", type: "success" });
        setResent(true);
        setResendTimer(45);
        setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
      } else {
        const data = await res.json();
        setToast({ show: true, message: data.detail || "No se pudo reenviar el código", type: "danger" });
      }
    } catch {
      setToast({ show: true, message: "Error de red o servidor", type: "danger" });
    } finally {
      setResending(false);
    }
  };

  // Temporizador para reenviar
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    } else if (resendTimer === 0 && resent) {
      setResent(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer, resent]);
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
        setTimeout(() => {
          history.push("/forgot-password-reset");
        }, 1800);
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
      <div className="fpverify-container fpverify-redirect">
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
    <div className="fpverify-container">
      <button
        className="back-btn"
        type="button"
        aria-label="Volver"
        onClick={() => history.goBack()}
      >
        <img src={atrasIcon} alt="Atrás" className="back-icon" />
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
        <div className="fpverify-resend-wrapper">
          <span className="fpverify-resend-text">
            ¿No has recibido el código?{' '}
            {resendTimer > 0 ? (
              <span className="fpverify-resend-timer">Reenviar ({resendTimer}s)</span>
            ) : (
              <button
                type="button"
                className="fpverify-resend-btn"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? 'Enviando...' : 'Reenviar'}
              </button>
            )}
          </span>
        </div>
        <button className="fpverify-btn" type="submit" disabled={loading}>
          {loading ? "Verificando..." : "Verificar código"}
        </button>
      </form>
      <div className="fp-steps-indicator">
        <span className="fp-step"></span>
        <span className="fp-step fp-step-active"></span>
        <span className="fp-step"></span>
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
