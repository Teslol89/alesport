import React, { useRef, useState } from 'react';
import { IonContent, IonHeader, IonPage, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import ReservasForm from '../components/ReservasForm';
import './Reservas.css';

const Reservas: React.FC = () => {
    const contentRef = useRef<HTMLIonContentElement | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);

    useIonViewWillEnter(() => {
        void contentRef.current?.scrollToTop(0);
        setRefreshSignal((current) => current + 1);
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
                <ReservasForm refreshSignal={refreshSignal} />
            </IonContent>
        </IonPage>
    );
};

export default Reservas;
