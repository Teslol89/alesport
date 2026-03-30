
import React, { useState } from "react";
import CustomToast from "./CustomStyles";
import "./ForgotPasswordRequestForm.css";


const ForgotPasswordRequestForm: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger" | "info">("danger");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (val: string) => {
    if (!val.trim()) return "Este campo es obligatorio";
    if (!/^\S+@\S+\.\S+$/.test(val.trim())) return "Formato de email inválido";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailError(eErr);
    if (eErr) {
      return;
    }
    setLoading(true);
    setShowToast(false);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      await fetch(`${apiUrl}/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      setToastMsg("Si el email existe, te hemos enviado un código para restablecer tu contraseña.");
      setToastType("success");
      setShowToast(true);
      setEmail("");
      setEmailError("");
    } catch {
      setToastMsg("Error de red o servidor");
      setToastType("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fprequest-container">
      <h2 className="fprequest-title">Recuperar contraseña</h2>
      <p className="fprequest-description">Introduce tu email y te enviaremos un código para restablecer tu contraseña.</p>
      <form onSubmit={handleSubmit}>
        <input
          className="fprequest-input"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (emailError) setEmailError("");
          }}
          onBlur={() => setEmailError(validateEmail(email))}
          autoComplete="email"
        />
        {emailError && (
          <div className="input-error-msg">{emailError}</div>
        )}
        <button className="fprequest-btn" type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar código"}
        </button>
      </form>
      <CustomToast
        show={showToast}
        message={toastMsg}
        onClose={() => setShowToast(false)}
        type={toastType}
        duration={3000}
      />
    </div>
  );
};

export default ForgotPasswordRequestForm;
