import React, { useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import alesportLogo1 from '../assets/img/alesportLogo1.jpg';
import './SplashPage.css';

// SplashPage: muestra el logo y un loader mientras se cargan datos o se decide a dónde redirigir
const SplashPage: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
    useEffect(() => {
        // Simula carga de datos o comprobaciones (puedes reemplazar el timeout por tu lógica real)
        const timer = setTimeout(() => {
            onFinish();
        }, 4500); // 4.5 segundos
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <IonPage className="splash-page">
            <IonContent fullscreen className="splash-content">
                <div className="splash-logo-container">
                    {/* Aquí pon tu logo real o un SVG */}
                    <div className="splash-logo">
                        <img className="splash-logo-img" src={alesportLogo1} alt="Alesport Logo" />
                        <div className="splash-loader"></div>
                    </div>
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
