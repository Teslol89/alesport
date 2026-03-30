import React, { useState, useRef } from "react";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { loginUser } from "../api/auth";
import { loginWithGoogle } from "../api/auth";
import { useAuth } from "./AuthContext";
import { useHistory } from "react-router-dom";
import CustomToast from "./CustomToast";



import ojoAbierto from "../icons/ojoAbierto.svg";
import ojoCerrado from "../icons/ojoCerrado.svg";
import appleLogo from '../icons/appleLogo.svg';
import googleLogo from '../icons/googleLogo.svg';
import alesportLogoHori from '../assets/img/alesportLogoHori.png';
import "./CustomToast.css";
import "./LoginForm.css";

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    // toastKey eliminado, ya no es necesario
    const { setToken } = useAuth();
    const history = useHistory();


    // Inicializar GoogleAuth (solo una vez)
    React.useEffect(() => {
        GoogleAuth.initialize({
            clientId: '516623761240-o7mo7hvef1lej6474cjsutrqdpo688om.apps.googleusercontent.com', // <-- Web Client ID
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
        });
    }, []);

    // Login con Google
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
            if (err?.message?.toLowerCase().includes("cancel") || err?.error === "popup_closed_by_user") {
                await GoogleAuth.signOut();
                setError("Cancelado.");
            } else {
                setError("Error al iniciar sesión");
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
            history.replace("/tab1");
        } catch (err) {
            setError("Error al iniciar sesión");
        }
    };

    return (
        <div className="login-container">
            <img src={alesportLogoHori} alt="Logo" className="login-logo" />            
            <div className="login-socials">
                <button className="social-btn">
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
                    <span
                        className="toggle-password-login"
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
                    <span className="forgot-password">¿Recuperar contraseña?</span>
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
                type="danger"
                duration={3000}
            />
        </div>
    );
};

export default LoginForm;