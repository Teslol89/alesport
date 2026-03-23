import React from "react";
import { Route, Redirect, RouteProps } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

const PrivateRoute: React.FC<RouteProps> = ({ component: Component, ...rest }) => {
  const { isAuthenticated } = useAuth();
  return (
    <Route
      {...rest}
      render={props =>
        isAuthenticated
          ? Component
            ? <Component {...props} />
            : null
          : (
            <Redirect
              to={{
                pathname: "/login",
                state: { from: props.location }
              }}
            />
          )
      }
    />
  );
};

export default PrivateRoute;
