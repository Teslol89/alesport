import React, { useState } from "react";
import { IonPage, IonContent, IonInput, IonButton, IonItem, IonLabel, IonToast, IonHeader, IonTitle, IonToolbar } from "@ionic/react";
import "./VerifyCode.css";

const VerifyCode: React.FC = () => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{show: boolean, message: string, color?: string}>({show: false, message: ""});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast({show: false, message: ""});
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || "/api"}/auth/verify-email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({show: true, message: data.message || "¡Email verificado!", color: "success"});
      } else {
        setToast({show: true, message: data.detail || "Código incorrecto", color: "danger"});
      }
    } catch {
      setToast({show: true, message: "Error de red o servidor", color: "danger"});
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Verificar email</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="verify-code-container">
          <h2 className="verify-code-title">Verifica tu correo</h2>
          <p className="verify-code-description">Introduce el email y el código que recibiste para activar tu cuenta.</p>
          <form className="verify-code-form" onSubmit={handleSubmit}>
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
        </div>
        <IonToast
          isOpen={toast.show}
          message={toast.message}
          cssClass={toast.color === "success" ? "verify-code-toast-success" : toast.color === "danger" ? "verify-code-toast-error" : undefined}
          duration={2500}
          onDidDismiss={() => setToast({show: false, message: ""})}
        />
      </IonContent>
    </IonPage>
  );
};

export default VerifyCode;
