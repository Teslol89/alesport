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
    return null;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Redirect to="/admin-calendar" />;
  }

  if (!Component) return null;
  return <Route {...rest} component={Component} />;
};

export default PrivateRoute;
