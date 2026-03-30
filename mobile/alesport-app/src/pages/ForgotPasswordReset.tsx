import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React from 'react';
import ForgotPasswordResetForm from '../components/ForgotPasswordResetForm';
import './ForgotPasswordPages.css';

const ForgotPasswordReset: React.FC = () => (
	<IonPage className="forgot-password-page">
		<IonHeader />
		<IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
			<div className="login-center-wrapper">
				<ForgotPasswordResetForm />
			</div>
		</IonContent>
	</IonPage>
);

export default ForgotPasswordReset;
