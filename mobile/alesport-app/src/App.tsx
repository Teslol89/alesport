import React, { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useHistory } from 'react-router-dom';
import { Route, Redirect } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import agendaIcon from './icons/agenda.svg';
import buscarIcon from './icons/buscar.webp';
import masIcon from './icons/mas.svg';
import configIcon from './icons/config.svg';
import AdminCalendarPage from './pages/AdminCalendarPage';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPasswordRequest from './pages/ForgotPasswordRequest';
import ForgotPasswordVerify from './pages/ForgotPasswordVerify';
import ForgotPasswordReset from './pages/ForgotPasswordReset';
import Tab2 from './pages/Tab2';
import TabSearch from './pages/Buscar';
import Tab3 from './pages/Tab3';
import SplashPage from './pages/SplashPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { getPendingUser, deletePendingUser } from './api/auth';
import CustomToast from './components/CustomStyles';
import VerifyCode from './pages/VerifyCode';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import './App.css';

setupIonicReact();

// App principal con SplashPage integrado
// Componente dedicado para la redirección de la ruta raíz
function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Redirect to={isAuthenticated ? "/admin-calendar" : "/login"} />;
}

const App: React.FC = () => {

  const [splashDone, setSplashDone] = useState(false);
  const [showToast, setShowToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const history = useHistory();

  // Al abrir la app, si hay un email pendiente de verificación y no hay sesión,
  // se limpia/elimina el usuario pendiente y se redirige siempre a /login.
  useEffect(() => {
    const checkAndCleanPendingUser = async () => {
      const pendingEmail = localStorage.getItem("pendingVerificationEmail");
      const isAuthenticated = !!localStorage.getItem("token");
      //
      if (pendingEmail && !isAuthenticated) {
        try {
          const user = await getPendingUser(pendingEmail);
          if (user) {
            await deletePendingUser(pendingEmail);
            localStorage.removeItem("pendingVerificationEmail");
            setShowToast({
              show: true,
              message: "Tu registro anterior no fue verificado y ha sido eliminado. Por favor, regístrate de nuevo."
            });
          } else {
            localStorage.removeItem("pendingVerificationEmail");
          }
        } catch (err) {
          console.error("[App.tsx][useEffect] Error al limpiar usuario pendiente:", err);
        }
        // Siempre redirigir a login si había pendingEmail y no autenticado
        history.replace("/login");
        return;
      }
    };
    checkAndCleanPendingUser();
  }, [history]);

  useEffect(() => {
    const handler = ({ url }: { url: string }) => {
      if (url) {
        // Deep link: alesport://verify-code?email=...&code=...
        if (url.startsWith('alesport://verify-code')) {
          try {
            const parsed = new URL(url);
            const email = parsed.searchParams.get('email');
            const code = parsed.searchParams.get('code');
            if (email && code) {
              history.push(`/verify-code?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
            } else {
              history.push('/verify-code');
            }
          } catch {
            history.push('/verify-code');
          }
        }
        // Fallback: si viene de web
        else if (url.includes('/verify-code')) {
          history.push('/verify-code');
        }
      }
    };
    CapacitorApp.addListener('appUrlOpen', handler);
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [history]);

  if (!splashDone) {
    return <SplashPage onFinish={() => setSplashDone(true)} />;
  }
  return (
    <IonApp>
      <IonReactRouter>
        <AuthProvider>
          <MainRoutes />
        </AuthProvider>
      </IonReactRouter>
      <CustomToast
        show={showToast.show}
        message={showToast.message}
        onClose={() => setShowToast({ show: false, message: "" })}
        type="danger"
        duration={3000}
      />
    </IonApp>
  );

  // Componente que separa rutas públicas y privadas
  function MainRoutes() {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
      return (
        <IonRouterOutlet>
          <Route exact path="/login" component={Login} />
          <Route exact path="/register" component={Register} />
          <Route exact path="/verify-code" component={VerifyCode} />
          <Route exact path="/forgot-password-request" component={ForgotPasswordRequest} />
          <Route exact path="/forgot-password-verify" component={ForgotPasswordVerify} />
          <Route exact path="/forgot-password-reset" component={ForgotPasswordReset} />
          <Route exact path="/" component={RootRedirect} />
        </IonRouterOutlet>
      );
    }
    return (
      <IonTabs>
        <IonRouterOutlet>
          <PrivateRoute exact path="/tab-search" component={TabSearch} />
          <PrivateRoute exact path="/admin-calendar" component={AdminCalendarPage} />
          <PrivateRoute exact path="/tab2" component={Tab2} />
          <PrivateRoute path="/tab3" component={Tab3} />
          <Route exact path="/" component={RootRedirect} />
        </IonRouterOutlet>
        <IonTabBar className="tabbar-glass" slot="bottom" >
          <IonTabButton tab="admin-calendar" href="/admin-calendar">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={agendaIcon} />
            <IonLabel>Agenda</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab-search" href="/tab-search">
            <img className="tabbar-search-icon" src={buscarIcon} alt="Buscar" aria-hidden="true" />
            <IonLabel>Buscar</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab2" href="/tab2">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={masIcon} />
            <IonLabel>Añadir</IonLabel>
          </IonTabButton>
          <IonTabButton tab="tab3" href="/tab3">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={configIcon} />
            <IonLabel>Configuración</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    );
  }
};

export default App;
