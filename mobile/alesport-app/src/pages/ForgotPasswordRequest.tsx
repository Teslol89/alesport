import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React from 'react';
import ForgotPasswordRequestForm from '../components/ForgotPasswordRequestForm';
import './ForgotPasswordPages.css';

const ForgotPasswordRequest: React.FC = () => (
	<IonPage className="forgot-password-page">
		<IonHeader />
		<IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
			<div className="login-center-wrapper">
				<ForgotPasswordRequestForm />
			</div>
		</IonContent>
	</IonPage>
);

export default ForgotPasswordRequest;
