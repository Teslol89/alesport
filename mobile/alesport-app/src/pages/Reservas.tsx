import React, { useRef } from 'react';
import { IonContent, IonHeader, IonPage, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import ReservasForm from '../components/ReservasForm';
import './Reservas.css';

const Reservas: React.FC = () => {
    const contentRef = useRef<HTMLIonContentElement | null>(null);

    useIonViewWillEnter(() => {
        void contentRef.current?.scrollToTop(0);
    });

    useIonViewDidLeave(() => {
        void contentRef.current?.scrollToTop(0);
    });

    return (
        <IonPage className="bookings-page">
            <IonHeader />
            <IonContent
                ref={contentRef}
                fullscreen
                scrollY={true}
                scrollEvents={true}
                forceOverscroll={true}
            >
                <ReservasForm />
            </IonContent>
        </IonPage>
    );
};

export default Reservas;
