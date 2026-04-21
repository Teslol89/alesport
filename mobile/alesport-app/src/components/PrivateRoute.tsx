// Este componente se encarga de proteger las rutas que requieren autenticación y autorización.
// Verifica si el usuario está autenticado y si tiene el rol adecuado para acceder a la ruta.
// Si no está autenticado, redirige al usuario a la página de inicio de sesión. Si el perfil 
// del usuario aún se está cargando, muestra la ruta sin verificar los roles. Si el usuario no
// tiene el rol adecuado, redirige a una página específica (en este caso, "admin-calendar").
import React from "react";
import { Route, Redirect, RouteProps } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

interface PrivateRouteProps extends RouteProps {
  component?: React.ComponentType<any>;
  allowedRoles?: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ component: Component, allowedRoles, ...rest }) => {
  const { isAuthenticated, isLoadingProfile, role } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (isLoadingProfile) {
    if (!Component) return null;
    return <Route {...rest} component={Component} />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Redirect to="/admin-calendar" />;
  }

  if (!Component) return null;
  return <Route {...rest} component={Component} />;
};

export default PrivateRoute;
