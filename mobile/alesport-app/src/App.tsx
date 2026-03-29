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
import { ellipse, square, triangle } from 'ionicons/icons';


import Login from './pages/Login';
import Register from './pages/Register';
import RegisterForm from './components/RegisterForm';
import Tab1 from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';
import SplashPage from './pages/SplashPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// import VerifyEmail from './pages/VerifyEmail';
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
  return <Redirect to={isAuthenticated ? "/tab1" : "/login"} />;
}

const App: React.FC = () => {
  const [splashDone, setSplashDone] = useState(false);
  const history = useHistory();

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
        <Route exact path="/" component={RootRedirect} />
      </IonRouterOutlet>
    );
  }
  return (
    <IonTabs>
      <IonRouterOutlet>
        <PrivateRoute exact path="/tab1" component={Tab1} />
        <PrivateRoute exact path="/tab2" component={Tab2} />
        <PrivateRoute path="/tab3" component={Tab3} />
        <Route exact path="/" component={RootRedirect} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="tab1" href="/tab1">
          <IonIcon aria-hidden="true" icon={triangle} />
          <IonLabel>Tab 1</IonLabel>
        </IonTabButton>
        <IonTabButton tab="tab2" href="/tab2">
          <IonIcon aria-hidden="true" icon={ellipse} />
          <IonLabel>Tab 2</IonLabel>
        </IonTabButton>
        <IonTabButton tab="tab3" href="/tab3">
          <IonIcon aria-hidden="true" icon={square} />
          <IonLabel>Tab 3</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
};

export default App;
