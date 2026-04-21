import React, { useState, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useHistory, useLocation } from 'react-router-dom';
import { Route, Redirect } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import agendaIcon from './icons/agenda.svg';
import agendaActiveIcon from './icons/agenda2.svg';
import buscarIcon from './icons/buscar.svg';
import buscarActiveIcon from './icons/buscar2.svg';
import crearIcon from './icons/crear.svg';
import crearActiveIcon from './icons/crear2.svg';
import configIcon from './icons/config.svg';
import configActiveIcon from './icons/config2.svg';
import AdminCalendarPage from './pages/AdminCalendarPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPasswordRequest from './pages/ForgotPasswordRequest';
import ForgotPasswordVerify from './pages/ForgotPasswordVerify';
import ForgotPasswordReset from './pages/ForgotPasswordReset';
import Crear from './pages/Crear';
import TabSearch from './pages/Buscar';
import Config from './pages/Config';
import Reservas from './pages/Reservas';
import VerifyCode from './pages/VerifyCode';
import SplashPage from './pages/SplashPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import { getPendingUser, deletePendingUser } from './api/auth';
import CustomToast from './components/CustomStyles';
import { PUSH_OPEN_SESSION_EVENT, readPendingPushNavigation } from './services/fcm';

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
import '@ionic/react/css/palettes/dark.class.css';
/* import '@ionic/react/css/palettes/dark.system.css'; */

/* Theme variables */
import './theme/variables.css';
import './components/CustomStyles.css';
import './App.css';

setupIonicReact();

function AppRouteLoadingScreen() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-label="Cargando">
      <IonSpinner className="app-route-loading__spinner" name="crescent" color="primary" />
    </div>
  );
}

// App principal con SplashPage integrado
// Componente dedicado para la redirección de la ruta raíz
function RootRedirect() {
  const { isAuthenticated, isLoadingProfile } = useAuth();

  if (isLoadingProfile) {
    return <AppRouteLoadingScreen />;
  }

  return <Redirect to={isAuthenticated ? "/admin-calendar" : "/login"} />;
}

function MainRoutes() {
  const { isAuthenticated, isLoadingProfile, role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const isAgendaActive = location.pathname.startsWith('/admin-calendar');
  const isSearchActive = location.pathname.startsWith('/search');
  const isCrearActive = location.pathname.startsWith('/crear');
  const isBookingsActive = location.pathname.startsWith('/bookings');
  const isConfigActive = location.pathname.startsWith('/config');
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isClient = role === 'client';
  const canManageSessions = role === 'admin' || role === 'superadmin' || role === 'trainer';
  const isAuthRoute = [
    '/login',
    '/register',
    '/verify-code',
    '/forgot-password-request',
    '/forgot-password-verify',
    '/forgot-password-reset',
  ].includes(location.pathname);

  if (!isAuthenticated || (isLoadingProfile && isAuthRoute)) {
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

  if (isAuthenticated && !isLoadingProfile && isAuthRoute) {
    return <Redirect to="/admin-calendar" />;
  }

  return (
    <IonTabs>
      <IonRouterOutlet>
        <PrivateRoute exact path="/admin-calendar" component={AdminCalendarPage} />
        <PrivateRoute exact path="/search" component={TabSearch} allowedRoles={["admin", "superadmin"]} />
        <PrivateRoute exact path="/crear" component={Crear} allowedRoles={["admin", "superadmin", "trainer"]} />
        <PrivateRoute exact path="/bookings" component={Reservas} allowedRoles={["client"]} />
        <PrivateRoute path="/config" component={Config} />
        <Route exact path="/" component={RootRedirect} />
      </IonRouterOutlet>
      <IonTabBar className="tabbar-glass" slot="bottom" >
        <IonTabButton tab="admin-calendar" href="/admin-calendar">
          <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={isAgendaActive ? agendaActiveIcon : agendaIcon} />
          <IonLabel>{t('tabs.agenda')}</IonLabel>
        </IonTabButton>
        {isAdmin ? (
          <IonTabButton tab="search" href="/search">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={isSearchActive ? buscarActiveIcon : buscarIcon} />
            <IonLabel>{t('tabs.search')}</IonLabel>
          </IonTabButton>
        ) : null}
        {canManageSessions ? (
          <IonTabButton tab="crear" href="/crear">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={isCrearActive ? crearActiveIcon : crearIcon} />
            <IonLabel>{t('tabs.create')}</IonLabel>
          </IonTabButton>
        ) : null}
        {isClient ? (
          <IonTabButton tab="bookings" href="/bookings">
            <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={isBookingsActive ? buscarActiveIcon : buscarIcon} />
            <IonLabel>{t('tabs.bookings')}</IonLabel>
          </IonTabButton>
        ) : null}
        <IonTabButton tab="config" href="/config">
          <IonIcon className="tabbar-icons-only" aria-hidden="true" icon={isConfigActive ? configActiveIcon : configIcon} />
          <IonLabel>{t('tabs.options')}</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

const DARK_MODE_STORAGE_KEY = 'alesport-dark-mode';

const App: React.FC = () => {

  const [splashDone, setSplashDone] = useState(false);
  const [showToast, setShowToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const history = useHistory();

  useEffect(() => {
    const isDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
    const ionApp = document.querySelector('ion-app');
    document.body.classList.toggle('ion-palette-dark', isDarkMode);
    document.documentElement.classList.toggle('ion-palette-dark', isDarkMode);
    ionApp?.classList.toggle('ion-palette-dark', isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
  }, []);

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
    const openSessionFromPush = () => {
      const pendingPayload = readPendingPushNavigation();
      if (!pendingPayload?.session_id) {
        return;
      }

      const params = new URLSearchParams();
      params.set('source', 'push');
      params.set('session', pendingPayload.session_id);
      if (pendingPayload.booking_id) {
        params.set('booking', pendingPayload.booking_id);
      }
      if (pendingPayload.session_date) {
        params.set('date', pendingPayload.session_date);
      }

      history.replace(`/admin-calendar?${params.toString()}`);
    };

    const handlePushOpen = () => {
      openSessionFromPush();
    };

    window.addEventListener(PUSH_OPEN_SESSION_EVENT, handlePushOpen as EventListener);
    openSessionFromPush();

    return () => {
      window.removeEventListener(PUSH_OPEN_SESSION_EVENT, handlePushOpen as EventListener);
    };
  }, [history]);

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | undefined;

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

    CapacitorApp.addListener('appUrlOpen', handler).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [history]);

  if (!splashDone) {
    return <SplashPage onFinish={() => setSplashDone(true)} />;
  }
  return (
    <IonApp>
      <IonReactRouter>
        <LanguageProvider>
          <AuthProvider>
              <MainRoutes />
          </AuthProvider>
        </LanguageProvider>
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
};

export default App;
