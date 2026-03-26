import React, { useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';

const ThemeToggle: React.FC = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <IonButton expand="block" onClick={() => setDark(d => !d)}>
      {dark ? 'Modo claro' : 'Modo oscuro'}
    </IonButton>
  );
};

export default ThemeToggle;
