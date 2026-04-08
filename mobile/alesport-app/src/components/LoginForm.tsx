import React, { useState, useRef } from "react";
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { loginUser } from "../api/auth";
import { loginWithGoogle } from "../api/auth";
import { useAuth } from "./AuthContext";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomStyles";



import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import appleLogo from '../icons/appleLogo.svg';
import googleLogo from '../icons/googleLogo.svg';
import alesportLogoHori from '../assets/img/alesportLogoHori.png';
import "./LoginForm.css";

const GOOGLE_WEB_CLIENT_ID = '516623761240-o7mo7hvef1lej6474cjsutrqdpo688om.apps.googleusercontent.com';
const IN_DEVELOPMENT_MESSAGE = 'En desarrollo.';

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [toastType, setToastType] = useState<"success" | "danger" | "info">("danger");
    const [toastPlacement, setToastPlacement] = useState<"top" | "center">("top");
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    // toastKey eliminado, ya no es necesario
    const { setToken } = useAuth();
    const history = useHistory();
    const isNativeIos = Capacitor.getPlatform() === 'ios';


    // Inicializar GoogleAuth (solo una vez)
    React.useEffect(() => {
        if (isNativeIos) {
            return;
        }

        GoogleAuth.initialize({
            clientId: GOOGLE_WEB_CLIENT_ID,
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
        });
    }, [isNativeIos]);

    const showInDevelopmentMessage = () => {
        setToastType("info");
        setToastPlacement("center");
        setError(IN_DEVELOPMENT_MESSAGE);
    };

    const handleAppleLogin = () => {
        showInDevelopmentMessage();
    };

    // Login con Google
    const handleGoogleLogin = async () => {
        setError(null);
        setToastType("danger");
        setToastPlacement("top");

        if (isNativeIos) {
            showInDevelopmentMessage();
            return;
        }

        try {
            const googleUser = await GoogleAuth.signIn();
            const idToken = (googleUser as any).idToken;
            if (!idToken) throw new Error('No se recibió idToken de Google');
            const data = await loginWithGoogle(idToken);
            setToken(data.access_token);
        } catch (err: any) {
            const rawMessage = String(err?.message ?? err?.error ?? '').toLowerCase();

            if (rawMessage.includes("cancel") || err?.error === "popup_closed_by_user") {
                await GoogleAuth.signOut();
                setToastType("info");
                setToastPlacement("center");
                setError("Cancelado.");
            } else if (rawMessage.includes('unimplemented') || rawMessage.includes('not implemented')) {
                showInDevelopmentMessage();
            } else {
                setToastType("danger");
                setToastPlacement("top");
                setError(err?.message || "Error al iniciar sesión con Google");
            }
        }
    };

    // Login tradicional
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (error) return; // Si el toast ya está visible, no mostrar otro
        try {
            const data = await loginUser(email, password);
            setToken(data.access_token);
        } catch (err) {
            setToastType("danger");
            setToastPlacement("top");
            setError("Error al iniciar sesión");
        }
    };

    return (
        <div className="login-container">
            <img src={alesportLogoHori} alt="Logo" className="login-logo" />            
            <div className="login-socials">
                <button className="social-btn" type="button" onClick={handleAppleLogin}>
                    <img src={appleLogo} alt="Apple" className="social-icon" /> Apple
                </button>
                <button className="social-btn" type="button" onClick={handleGoogleLogin}>
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