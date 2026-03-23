import React from "react";
import { useAuth } from "./AuthContext";
import { useHistory } from "react-router-dom";

const LogoutButton: React.FC = () => {
    const { logout } = useAuth();
    const history = useHistory();

    const handleLogout = () => {
        logout(); // Limpia token y estado
        history.replace("/login");
    };

    return (
        <button onClick={handleLogout}>
            Cerrar sesión
        </button>
    );
};

export default LogoutButton;