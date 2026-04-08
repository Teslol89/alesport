import React from "react";
import { IonSpinner } from "@ionic/react";
import { Route, Redirect, RouteProps } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

interface PrivateRouteProps extends RouteProps {
  component?: React.ComponentType<any>;
  allowedRoles?: string[];
}

const RouteLoadingFallback: React.FC = () => (
  <div className="app-route-loading" role="status" aria-live="polite">
    <IonSpinner className="app-route-loading__spinner" name="crescent" color="primary" />
  </div>
);

const PrivateRoute: React.FC<PrivateRouteProps> = ({ component: Component, allowedRoles, ...rest }) => {
  const { isAuthenticated, isLoadingProfile, role } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (isLoadingProfile) {
    return <Route {...rest} render={() => <RouteLoadingFallback />} />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Redirect to="/admin-calendar" />;
  }

  if (!Component) return null;
  return <Route {...rest} component={Component} />;
};

export default PrivateRoute;
