import React, { useState, useRef } from "react";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { loginUser } from "../api/auth";
import { loginWithGoogle } from "../api/auth";
import { useAuth } from "./AuthContext";
import { useHistory } from "react-router-dom";
import { IonToast } from "@ionic/react";

import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import appleLogo from '../icons/appleLogo.svg';
import googleLogo from '../icons/googleLogo.svg';
import "./LoginForm.css";

const LoginForm: React.FC = () => {

    // Inicializar GoogleAuth (solo una vez)
    React.useEffect(() => {
        GoogleAuth.initialize({
            clientId: '516623761240-o7mo7hvef1lej6474cjsutrqdpo688om.apps.googleusercontent.com', // <-- Web Client ID
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
        });
    }, []);

    // Login con Google
    // ...existing code...
    const handleGoogleLogin = async () => {
        setError(null);
        try {
            const googleUser = await GoogleAuth.signIn();
            const idToken = (googleUser as any).idToken;
            if (!idToken) throw new Error('No se recibió idToken de Google');
            const data = await loginWithGoogle(idToken);
            setToken(data.access_token);
            history.replace("/tab1");
        } catch (err: any) {
            setError("Error al iniciar sesión con Google: " + (err?.message || JSON.stringify(err)));
        }
    };
    // ...existing code...

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const { setToken } = useAuth();
    const history = useHistory();


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const data = await loginUser(email, password);
            setToken(data.access_token);
            history.replace("/tab1");
        } catch (err) {
            setError("Error al iniciar sesión");
        }
    };

    return (
        <div className="login-container">
            <h2 className="login-title">Iniciar sesión</h2>
            <p className="login-description">Introduce tu correo electrónico y contraseña para acceder a tu cuenta.</p>
            <div className="login-socials">
                <button className="social-btn apple">
                    <img src={appleLogo} alt="Apple" className="social-icon" /> Apple
                </button>
                <button className="social-btn google" type="button" onClick={handleGoogleLogin}>
                    <img src={googleLogo} alt="Google" className="social-icon" /> Google
                </button>
            </div>
            <div className="login-divider">
                <span className="divider-line"></span>
                <span className="divider-text">o</span>
                <span className="divider-line"></span>
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
                <div className="login-options">
                    <span className="forgot-password">¿Olvidaste tu contraseña?</span>
                </div>
                <button type="submit" className="login-btn">Iniciar sesión</button>
            </form>
            <div className="login-footer">
                ¿No tienes una cuenta? <span className="signup-link">Regístrate</span>
            </div>
            <IonToast
                isOpen={!!error}
                onDidDismiss={() => setError(null)}
                message={error || ''}
                duration={3000}
                color="danger"
                position="top" />
        </div>
    );

};

export default LoginForm;