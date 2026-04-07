import React, { useRef } from 'react';
import { IonContent, IonHeader, IonPage, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import ConfigForm from '../components/ConfigForm';
import './Config.css';

const Config: React.FC = () => {
  const contentRef = useRef<HTMLIonContentElement | null>(null);

  useIonViewWillEnter(() => {
    void contentRef.current?.scrollToTop(0);
  });

  useIonViewDidLeave(() => {
    void contentRef.current?.scrollToTop(0);
  });

  return (
    <IonPage className="config-page">
      <IonHeader />
      <IonContent
        ref={contentRef}
        fullscreen
        scrollY={true}
        scrollEvents={true}
        forceOverscroll={true}
      >
        <div className="config-center-wrapper">
          <ConfigForm />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Config;
