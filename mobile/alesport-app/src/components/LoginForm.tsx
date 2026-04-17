import React, { useRef, useState } from "react";
import { loginUser } from "../api/auth";
import { useAuth } from "./AuthContext";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomStyles";

import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import alesportLogoHori from '../assets/img/alesportLogoHori.png';
import "./LoginForm.css";

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [toastType, setToastType] = useState<"success" | "danger" | "info">("danger");
    const [toastPlacement, setToastPlacement] = useState<"top" | "center">("top");
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const { setToken } = useAuth();
    const history = useHistory();

    // Login tradicional
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (error) return; // Si el toast ya está visible, no mostrar otro
        try {
            const data = await loginUser(email, password);
            setToken(data.access_token);
            history.replace("/admin-calendar");
        } catch (err) {
            setToastType("danger");
            setToastPlacement("top");
            setError("Error al iniciar sesión");
        }
    };

    return (
        <div className="login-container">
            <img src={alesportLogoHori} alt="Logo" className="login-logo" />
            <div className="login-welcome">
                <p className="login-welcome-title">Bienvenido a Alesport</p>
                <p className="login-welcome-text">Tu espacio para reservar clases y seguir avanzando en tu entrenamiento día a día.</p>
            </div>
            <div className="login-divider" aria-hidden="true">
                <span className="divider-line login-divider-line-full"></span>
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="login-input"
                />
                <div className="password-wrapper">
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="login-input"
                        autoComplete="current-password"
                        ref={passwordInputRef}
                        onFocus={() => {
                            // Forzar scroll al enfocar
                            setTimeout(() => {
                                passwordInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }, 300);
                        }}
                    />
                    <button
                        type="button"
                        className="toggle-password-login"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        tabIndex={0}
                        style={{ background: 'transparent', border: 'none', padding: 0 }}
                    >
                        <img
                            src={showPassword ? ojoCerrado : ojoAbierto}
                            alt={showPassword ? "Ojo cerrado" : "Ojo abierto"}
                            style={{ width: 24, height: 24 }}
                        />
                    </button>
                </div>
                <div className="login-options">
                    <span
                        className="forgot-password"
                        onClick={() => history.push('/forgot-password-request')}
                    >
                        ¿Recuperar contraseña?
                    </span>
                </div>
                <button type="submit" className="login-btn">Iniciar sesión</button>
            </form>
            <div className="login-footer">¿No tienes una cuenta?
                <button type="button" className="signup-link"
                    onClick={() => history.push('/register')}>Regístrate
                </button>
            </div>
            <CustomToast
                show={!!error}
                message={error || ''}
                onClose={() => setError(null)}
                type={toastType}
                placement={toastPlacement}
                duration={2200}
            />
        </div>
    );
};

export default LoginForm;