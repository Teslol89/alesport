import React, { useState } from "react";
// import { deletePendingUser } from "../api/auth";
import { IonToast } from "@ionic/react";
import { useHistory } from "react-router-dom";
import "./VerifyCodeForm.css";

const VerifyCodeForm: React.FC = () => {
    const history = useHistory();
    const [email, setEmail] = useState(() => localStorage.getItem("pendingVerificationEmail") || "");
    const emailFromStorage = localStorage.getItem("pendingVerificationEmail") || "";
    const [noPending, setNoPending] = useState(false);
    React.useEffect(() => {
        const pendingEmail = localStorage.getItem("pendingVerificationEmail");
        console.log("[VerifyCodeForm] pendingVerificationEmail:", pendingEmail);
        if (!pendingEmail) {
            setNoPending(true);
            history.replace("/login");
            return;
        }
        // No se comprueba en backend, solo se permite verificar si hay email pendiente
    }, [history]);
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, message: string, color?: string }>({ show: false, message: "" });

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
                // Limpiar el email de localStorage al verificar correctamente
                localStorage.removeItem("pendingVerificationEmail");
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

    if (noPending) {
        return (
            <div className="verify-code-container">
                <h2 className="verify-code-title">No hay registro pendiente</h2>
                <p className="verify-code-description">Redirigiendo a login...</p>
            </div>
        );
    }
    return (
        <div className="verify-code-container">
            <h2 className="verify-code-title">Verifica tu correo</h2>
            <p className="verify-code-description">
                Hemos enviado un código a <b>{email}</b>.<br />Introdúcelo para activar tu cuenta.
            </p>
            <form onSubmit={handleSubmit}>
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
