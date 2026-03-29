import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React from 'react';
import './VerifyCode.css';
import VerifyCodeForm from '../components/VerifyCodeForm';

const VerifyCode: React.FC = () => {
    return (
        <IonPage className="verify-code-page">
            <IonHeader />
            <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
                <div className="verify-code-center-wrapper">
                    <VerifyCodeForm />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default VerifyCode;