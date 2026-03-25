import React from "react";
import { Route, Redirect, RouteProps } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

const PrivateRoute: React.FC<RouteProps> = ({ component: Component, ...rest }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  // Si no hay componente, no renderiza nada
  if (!Component) return null;
  return <Route {...rest} component={Component} />;
};

export default PrivateRoute;
