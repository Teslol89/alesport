import React, { useState } from "react";
import { IonInput, IonButton, IonToast, IonItem, IonLabel } from "@ionic/react";
import { useHistory } from "react-router-dom";
import "./VerifyCodeForm.css";

const VerifyCodeForm: React.FC = () => {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, color?: string }>({ show: false, message: "" });
    const history = useHistory();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setToast({ show: false, message: "" });
        try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || "/api";
            const res = await fetch(`${apiUrl}/auth/verify-email-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (res.ok) {
                setToast({ show: true, message: data.message || "¡Email verificado!", color: "success" });
                setTimeout(() => {
                    history.push("/login");
                }, 1800);
            } else {
                setToast({ show: true, message: data.detail || "Código incorrecto", color: "danger" });
            }
        } catch {
            setToast({ show: true, message: "Error de red o servidor", color: "danger" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="verify-code-container">
            <h2 className="verify-code-title">Verifica tu correo</h2>
            <p className="verify-code-description">Introduce el email y el código recibido en el correo para activar tu cuenta.</p>
            <form onSubmit={handleSubmit}>
                <input
                    className="verify-code-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                />
                <input
                    className="verify-code-input"
                    type="text"
                    placeholder="Código de verificación"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    required
                    maxLength={6}
                    inputMode="text"
                />
                <button className="verify-code-btn" type="submit" disabled={loading}>
                    {loading ? "Verificando..." : "Verificar"}
                </button>
            </form>
            <IonToast
                isOpen={toast.show}
                message={toast.message}
                cssClass={toast.color === "success" ? "verify-code-toast-success" : toast.color === "danger" ? "verify-code-toast-error" : undefined}
                duration={2500}
                onDidDismiss={() => setToast({ show: false, message: "" })}
                position="top"
            />
        </div>
    );
};

export default VerifyCodeForm;
