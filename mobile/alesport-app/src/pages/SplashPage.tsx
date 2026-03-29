import React, { useEffect } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import alesportLogo1 from '../assets/img/alesportLogo1.jpg';
import verdeLabsHori from '../assets/img/verdeLabsHori.png';
import './SplashPage.css';


// SplashPage: muestra el logo y un loader mientras se cargan datos o se decide a dónde redirigir
const SplashPage: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
    useEffect(() => {
        // Simula carga de datos o comprobaciones (puedes reemplazar el timeout por tu lógica real)
        const timer = setTimeout(() => {
            onFinish();
        }, 2500); // 2.5 segundos (valor original)
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <IonPage className="splash-page">
            <IonContent fullscreen className="splash-content">
                <div className="splash-logo-container">
                    {/* Aquí pon tu logo real o un SVG */}
                    <div className="splash-logo">
                        <img className="splash-logo-img" src={alesportLogo1} alt="Alesport Logo" />
                        <div className="splash-loader-dots">
                            <div></div>
                            <div></div>
                            <div></div>
                        </div>
                    </div>
                </div>
            </IonContent>
            <footer className="splash-footer">
                <div className="splash-footer-logo">
                    <div className="splash-footer-img-container">
                        <img className="splash-footer-img" src={verdeLabsHori} alt="Verde Labs Logo" />
                        <div className="splash-footer-from">from</div>
                    </div>
                </div>
            </footer>
        </IonPage>
    );
};

export default SplashPage;
