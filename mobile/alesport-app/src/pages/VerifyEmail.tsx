import React, { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { IonPage, IonContent, IonButton, IonSpinner, IonIcon } from "@ionic/react";
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import VerifyEmailInfo from "../components/VerifyEmailInfo";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const VerifyEmail: React.FC = () => {
  const query = useQuery();
  const history = useHistory();
  const [status, setStatus] = useState<"pending" | "success" | "error" | "no-token">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = query.get("token");
    if (!token) {
      setStatus("no-token");
      setMessage("");
      return;
    }
    fetch(`${process.env.REACT_APP_API_URL || "/api"}/auth/verify-email?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "¡Email verificado correctamente! Ya puedes iniciar sesión.");
        } else {
          setStatus("error");
          setMessage(data.detail || "Token inválido o expirado.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de red al verificar el email.");
      });
  }, [query]);

  if (status === "no-token") {
    return <VerifyEmailInfo />;
  }
  return (
    <IonPage>
      <IonContent className="ion-padding" style={{
        '--background': '#fff',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          maxWidth: 400,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: 32,
          textAlign: 'center',
        }}>
          {status === "pending" && (
            <>
              <IonSpinner style={{ fontSize: 32, marginBottom: 16 }} />
              <p style={{ margin: 0, color: '#222', fontWeight: 500 }}>Verificando email...</p>
            </>
          )}
          {status !== "pending" && (
            <>
              <IonIcon
                icon={status === "success" ? checkmarkCircleOutline : closeCircleOutline}
                style={{ fontSize: 56, color: status === "success" ? '#2dd36f' : '#eb445a', marginBottom: 8 }}
              />
              <h2 style={{ color: status === "success" ? '#2dd36f' : '#eb445a', marginBottom: 8 }}>
                {status === "success" ? "¡Verificado con éxito!" : "Error"}
              </h2>
              <p style={{ color: '#222', marginBottom: 24 }}>{message}</p>
              <IonButton expand="block" onClick={() => history.push("/login")}>Ir a iniciar sesión</IonButton>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default VerifyEmail;
