import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React, { useEffect } from 'react';

import './Login.css';
import LoginForm from '../components/LoginForm';

const Login: React.FC = () => {
    useEffect(() => {
        // Forzar modo claro al entrar
        document.body.classList.remove('dark');
        return () => {
            // (Opcional) restaurar modo anterior si lo deseas
        };
    }, []);

    return (
        <IonPage className="login-page">
            <IonHeader />
            <IonContent fullscreen>
                {/* Wrapper para centrar vertical y horizontalmente */}
                <div className="login-center-wrapper">
                    <LoginForm />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;