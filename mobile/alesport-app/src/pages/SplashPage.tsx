import React, { useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import alesportLogo from '../assets/img/alesportLogo.png';
import './SplashPage.css';

// SplashPage: muestra el logo y un loader mientras se cargan datos o se decide a dónde redirigir
const SplashPage: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
    useEffect(() => {
        // Simula carga de datos o comprobaciones (puedes reemplazar el timeout por tu lógica real)
        const timer = setTimeout(() => {
            onFinish();
        }, 2500); // 2.5 segundos
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <IonPage className="splash-page">
            <IonContent fullscreen className="splash-content">
                <div className="splash-logo-container">
                    {/* Aquí pon tu logo real o un SVG */}
                    <img src={alesportLogo} alt="Alesport Logo" className="splash-logo" />
                    <div className="splash-loader"></div>
                </div>
                                <footer className="splash-footer">
                                    <div className="splash-footer-from">from</div>
                                    <div className="splash-footer-brand">Verdeguer Labs</div>
                                </footer>
            </IonContent>
        </IonPage>
    );
};

export default SplashPage;
