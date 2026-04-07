import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React, { useEffect } from 'react';

import './Login.css';
import LoginForm from '../components/LoginForm';

const Login: React.FC = () => {
    useEffect(() => {
        const isDarkMode = localStorage.getItem('alesport-dark-mode') === 'true';
        document.body.classList.toggle('ion-palette-dark', isDarkMode);
        document.documentElement.classList.toggle('ion-palette-dark', isDarkMode);
        document.body.classList.toggle('dark', isDarkMode);
    }, []);

    return (
        <IonPage className="login-page">
            <IonHeader />
            <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
                {/* Wrapper para centrar vertical y horizontalmente */}
                <div className="login-center-wrapper">
                    <LoginForm />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Login;