import React, { useState } from "react";
import { IonModal, IonButton } from "@ionic/react";
import { LegalText } from "../utils/legalText";
import "./RegisterForm.css";

const RegisterForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) return;
    // Aquí irá la lógica de registro
    alert("Registro enviado");
  };

  const handleOpenModal = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleAccept = () => {
    setAcceptedTerms(true);
    setShowModal(false);
  };

  return (
    <div className="register-container">
      <h2 className="register-title">Crear cuenta</h2>
      <p className="register-description">Introduce tu nombre, correo electrónico y contraseña para crear una cuenta.</p>
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
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="register-input"
        />
        <div className="register-terms-modal">
          <span className="register-terms-text">
            Al crear una cuenta, aceptas los
            <a href="#" className="a" onClick={handleOpenModal}> términos y condiciones </a>y la
            <a href="#" onClick={handleOpenModal}> política de privacidad</a>.
          </span>
        </div>
        <button type="submit" className="register-btn" disabled={!acceptedTerms}>Crear cuenta</button>
      </form>
      <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <div className="modal-content">
          <h3>Términos y condiciones & Política de privacidad</h3>
          <div className="modal-scroll">
            <LegalText />
          </div>
          <IonButton expand="block" className="modal-accept-btn" onClick={handleAccept}>Acepto</IonButton>
          <IonButton expand="block" fill="clear" className="modal-cancel-btn"onClick={() => setShowModal(false)}>Cancelar</IonButton>
        </div>
      </IonModal>
    </div>
  );
};

export default RegisterForm;
