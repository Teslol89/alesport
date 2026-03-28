import React from "react";
import { IonButton, IonContent, IonPage } from "@ionic/react";
import { useHistory } from "react-router-dom";

const VerifyEmailInfo: React.FC = () => {
  const history = useHistory();
  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <h2>Verifica tu correo</h2>
          <p>
            Te hemos enviado un email de verificación.<br />
            Por favor, revisa tu bandeja de entrada y sigue el enlace para activar tu cuenta.
          </p>
          <IonButton expand="block" onClick={() => history.push("/login")}>Ir a iniciar sesión</IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default VerifyEmailInfo;
