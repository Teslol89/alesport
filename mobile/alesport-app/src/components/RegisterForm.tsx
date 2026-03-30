import React, { useState, useRef } from "react";
import { useHistory } from "react-router-dom";
import { Link } from "react-router-dom";
import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import { IonModal, IonButton } from "@ionic/react";
import CustomToast from "./CustomStyles";
import { registerUser } from "../api/auth";
import { LegalText } from "../utils/legalText";
import "./RegisterForm.css";

// Animación shake para los errores de los inputs
const shakeClass = "shake-anim";

// Componente principal de registro
const RegisterForm: React.FC = () => {
  // Hook de navegación de React Router para redirigir tras el registro exitoso
  const history = useHistory();
  // Estados para los campos del formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Estados para validación y animación
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [shakeName, setShakeName] = useState(false);
  const [shakeEmail, setShakeEmail] = useState(false);
  const [shakePassword, setShakePassword] = useState(false);

  // Validaciones simples
  const validateName = (val: string) => {
    if (!val.trim()) return "Nombre: Este campo es obligatorio";
    if (val.trim().length < 2) return "Nombre: Debe tener al menos 2 caracteres";
    return "";
  };
  const validateEmail = (val: string) => {
    if (!val.trim()) return "Email: Este campo es obligatorio";
    // Regex simple para email
    if (!/^\S+@\S+\.\S+$/.test(val.trim())) return "Email: Formato inválido";
    return "";
  };
  const validatePassword = (val: string) => {
    if (!val) return "Contraseña: Este campo es obligatorio";
    if (val.length < 6) return "Contraseña: Debe tener al menos 6 caracteres";
    return "";
  };

  // Estados para términos y condiciones
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [canAccept, setCanAccept] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "danger" | "info">("danger");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // ...validaciones de campos...

    // Validación previa antes de enviar
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);

    // 1. Si los 3 campos vacíos
    if (!name && !email && !password) {
      setIsSubmitting(false);
      setToastMsg("Formulario incompleto");
      setToastType("danger");
      setShowToast(true);
      return;
    }

    // 2. Si nombre inválido
    if (nErr) {
      setIsSubmitting(false);
      // Solo mostrar el error debajo del input, no toast
      return;
    }

    // 3. Si nombre válido, email vacío o inválido
    if (!eErr && (!email || email.trim() === "")) {
      setIsSubmitting(false);
      setToastMsg("Formulario incompleto");
      setToastType("danger");
      setShowToast(true);
      return;
    }
    if (eErr) {
      setIsSubmitting(false);
      // Solo mostrar el error debajo del input, no toast
      return;
    }

    // 4. Si nombre y email válidos, pero contraseña vacía o inválida
    if (!pErr && (!password || password.trim() === "")) {
      setIsSubmitting(false);
      setToastMsg("Formulario incompleto");
      setToastType("danger");
      setShowToast(true);
      return;
    }
    if (pErr) {
      setIsSubmitting(false);
      // Solo mostrar el error debajo del input, no toast
      return;
    }

    // 5. Si todo es válido pero no se han aceptado los términos
    if (!acceptedTerms) {
      setIsSubmitting(false);
      setToastMsg("Debes aceptar los términos y condiciones para crear una cuenta.");
      setToastType("danger");
      setShowToast(true);
      return;
    }

    try {
      await registerUser(name, email, password);
      // Guardar el email en localStorage para el flujo de verificación
      localStorage.setItem("pendingVerificationEmail", email);
      setToastMsg("Registro exitoso. Revisa tu correo para activar tu cuenta.");
      setToastType("success");
      setShowToast(true);
      setName("");
      setEmail("");
      setPassword("");
      setAcceptedTerms(false);
      // Mostrar el toast durante 3.5 segundos y luego redirigir a /verify-code
      setTimeout(() => {
        history.push("/verify-code");
      }, 3500); // 3.5 segundos para que el usuario vea el toast
    } catch (err: any) {
      let msg = "No se pudo registrar el usuario.";
      let color = "toast-error-register";
      const details =
        err?.apiDetail ||
        err?.cause?.apiDetail ||
        err?.response?.data?.detail;
      const getErrorMessage = (e: any) => {
        return e?.msg || e?.message || "Error desconocido";
      };
      if (Array.isArray(details)) {
        const fieldOrder = [
          { key: "name", label: "Nombre" },
          { key: "email", label: "Email" },
          { key: "password", label: "Contraseña" },
        ];
        const errorLines: string[] = [];
        const usedIndexes = new Set();
        for (const { key, label } of fieldOrder) {
          const idx = details.findIndex((d: any) =>
            Array.isArray(d.loc) && d.loc.includes(key)
          );
          if (idx !== -1) {
            errorLines.push(label + ": " + getErrorMessage(details[idx]));
            usedIndexes.add(idx);
          }
        }
        details.forEach((d: any, i: number) => {
          if (!usedIndexes.has(i)) {
            errorLines.push(getErrorMessage(d));
          }
        });
        msg = errorLines.join("\n");
        color = "danger";
      } else if (typeof err.message === "string") {
        if (err.message.toLowerCase().includes("email")) {
          msg = "El email ya está registrado. Usa otro o inicia sesión.";
        } else {
          msg = err.message;
        }
      } else {
        console.error("Error inesperado:", err);
      }
      setToastMsg(msg);
      // setToastColor eliminado
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers para animación shake y validación secuencial
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef2 = useRef<HTMLInputElement>(null);

  const handleNameBlur = () => {
    const err = validateName(name);
    setNameError(err);
  };

  // Si el usuario intenta enfocar el email pero el nombre no es válido, sacudir el input del nombre
  const handleEmailFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (validateName(name)) {
      setShakeName(true);
      setTimeout(() => setShakeName(false), 500);
      nameInputRef.current?.focus();
    }
  };

  // Validar email al perder el foco
  const handleEmailBlur = () => {
    const err = validateEmail(email);
    setEmailError(err);
  };

  // Validar contraseña al enfocar
  const handlePasswordFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (validateName(name)) {
      setShakeName(true);
      setTimeout(() => setShakeName(false), 500);
      nameInputRef.current?.focus();
      return;
    }
    if (validateEmail(email)) {
      setShakeEmail(true);
      setTimeout(() => setShakeEmail(false), 500);
      emailInputRef.current?.focus();
    }
  };

  // Validar contraseña al perder el foco
  const handlePasswordBlur = () => {
    const err = validatePassword(password);
    setPasswordError(err);
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
      <p className="register-return">¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link></p>

      <form onSubmit={handleSubmit}>
        <input
          className="register-input"
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          ref={nameInputRef}

        />
        {nameError && (
          <div className={`input-error-msg${shakeName ? ' ' + shakeClass : ''}`}>{(nameError || "").replace(/^Nombre: /, "")}</div>
        )}
        <input
          className="register-input"
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={handleEmailFocus}
          onBlur={handleEmailBlur}
          ref={emailInputRef}
          disabled={!!validateName(name)}
        />
        {emailError && (
          <div className={`input-error-msg${shakeEmail ? ' ' + shakeClass : ''}`}>{(emailError || "").replace(/^Email: /, "")}</div>
        )}
        <div className="password-wrapper">
          <input
            className="register-input"
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={handlePasswordFocus}
            onBlur={handlePasswordBlur}
            ref={passwordInputRef2}
            autoComplete="new-password"
            disabled={!!validateName(name) || !!validateEmail(email)}
          />
          <span
            className="toggle-password-register"
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
        {passwordError && (
          <div className={`input-error-msg${shakePassword ? ' ' + shakeClass : ''}`}>{(passwordError || "").replace(/^Contraseña: /, "")}</div>
        )}
        <div className="register-terms-modal">
          <span className="register-terms-text">
            Al crear una cuenta, aceptas los
            <a href="#" className="a" onClick={handleOpenModal}> términos y condiciones </a>y la
            <a href="#" onClick={handleOpenModal}> política de privacidad</a>.
          </span>
        </div>
        <button
          type="submit"
          className="register-btn"
          disabled={isSubmitting}
        >
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
      {/* Toast fuera del flujo del formulario para evitar desplazamiento */}
      <CustomToast
        show={showToast}
        message={toastMsg}
        onClose={() => setShowToast(false)}
        type={toastType}
        duration={3000}
      />
    </div>
  );
}

export default RegisterForm;
