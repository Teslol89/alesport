import { IonPage, IonHeader, IonContent } from '@ionic/react';
import React from 'react';
import ForgotPasswordVerifyForm from '../components/ForgotPasswordVerifyForm';
import './ForgotPasswordPages.css';

const ForgotPasswordVerify: React.FC = () => (
	<IonPage className="forgot-password-page">
		<IonHeader />
		<IonContent fullscreen scrollY={true} scrollEvents={true} forceOverscroll={true}>
			<div className="login-center-wrapper">
				<ForgotPasswordVerifyForm />
			</div>
		</IonContent>
	</IonPage>
);

export default ForgotPasswordVerify;
