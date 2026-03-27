import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React from 'react';
import './Register.css';
import RegisterForm from '../components/RegisterForm';

const Register: React.FC = () => {
    return (
        <IonPage className="register-page">
            <IonHeader />
            <IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
                <div className="register-center-wrapper">
                    <RegisterForm />
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Register;
