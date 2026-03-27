import React, { useState, useRef } from "react";
import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import { IonModal, IonButton, IonToast } from "@ionic/react";
import { registerUser } from "../api/auth";
import { LegalText } from "../utils/legalText";
import "./RegisterForm.css";

const RegisterForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState("toast-error-register");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setToastMsg("Debes aceptar los términos y condiciones para crear una cuenta.");
      setToastColor("toast-error-register");
      setShowToast(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await registerUser(name, email, password);
      setToastMsg("¡Registro exitoso!.");
      setToastColor("toast-success-register");
      setShowToast(true);
      setName("");
      setEmail("");
      setPassword("");
      setAcceptedTerms(false);
    } catch (err: any) {
      setToastMsg(err.message || "No se pudo registrar el usuario.");
      setToastColor("toast-error-register");
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir el modal al hacer clic en los enlaces de términos o privacidad
  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setCanAccept(false); // Resetear cada vez que se abre
    setShowModal(true);
  };

  // Cuando el usuario acepta los términos
  const handleAccept = () => {
    setAcceptedTerms(true);
    setShowModal(false);
    setCanAccept(false);
  }

  // Habilita el botón solo si se ha hecho scroll hasta el final
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 2) {
      setCanAccept(true);
    } else {
      setCanAccept(false);
    }
  };

  return (
    <div className="register-container">
      <h2 className="register-title">Crear cuenta</h2>
      <p className="register-description">Introduce tu nombre, correo electrónico y contraseña para crear una cuenta.</p>
      <div className="login-divider">
        <span className="divider-line"></span>
        <span className="divider-text">o</span>
        <span className="divider-line"></span>
      </div>
      <p className="register-return">¿Ya tienes una cuenta? <a href="/login">Inicia sesión</a></p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="register-input"
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="register-input"
        />
        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="register-input"
            autoComplete="new-password"
            ref={passwordInputRef}
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={0}
            role="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <img
              src={showPassword ? ojoCerrado : ojoAbierto}
              alt={showPassword ? "Ojo cerrado" : "Ojo abierto"}
              style={{ width: 24, height: 24 }}
            />
          </span>
        </div>
        <div className="register-terms-modal">
          <span className="register-terms-text">
            Al crear una cuenta, aceptas los
            <a href="#" className="a" onClick={handleOpenModal}> términos y condiciones </a>y la
            <a href="#" onClick={handleOpenModal}> política de privacidad</a>.
          </span>
        </div>
        <button type="submit" className="register-btn" disabled={isSubmitting}>
          {isSubmitting ? "Registrando..." : "Crear cuenta"}
        </button>
      </form>
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <div className="modal-content">
          <h3>Términos y condiciones & Política de privacidad</h3>
          <div className="modal-scroll" onScroll={handleScroll}>
            <LegalText />
          </div>
          <IonButton expand="block" className="modal-accept-btn" onClick={handleAccept} disabled={!canAccept}>
            {canAccept ? 'Acepto' : 'Leer para aceptar'}
          </IonButton>
          <IonButton expand="block" fill="clear" className="modal-cancel-btn" onClick={() => setShowModal(false)}>Cancelar</IonButton>
        </div>
      </IonModal>
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMsg}
        duration={3000}
        position="top"
        cssClass={toastColor}
      />
    </div>
  );
};

export default RegisterForm;
