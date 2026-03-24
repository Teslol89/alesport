import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonInput, IonButton } from '@ionic/react';
import LoginForm from '../components/LoginForm';

const Login: React.FC = () => (
    <IonPage>
        <IonHeader>
        </IonHeader>
        <IonContent fullscreen>
            <LoginForm />
        </IonContent>
    </IonPage>
);

export default Login;