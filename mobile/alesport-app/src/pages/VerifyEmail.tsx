import React, { useEffect, useState } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { IonPage, IonContent, IonButton, IonSpinner } from "@ionic/react";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const VerifyEmail: React.FC = () => {
  const query = useQuery();
  const history = useHistory();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = query.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Token de verificación no proporcionado.");
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

  return (
    <IonPage>
      <IonContent className="ion-padding">
        {status === "pending" && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <IonSpinner />
            <p>Verificando email...</p>
          </div>
        )}
        {status !== "pending" && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <h2>{status === "success" ? "¡Éxito!" : "Error"}</h2>
            <p>{message}</p>
            <IonButton expand="block" onClick={() => history.push("/login")}>Ir a iniciar sesión</IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default VerifyEmail;
