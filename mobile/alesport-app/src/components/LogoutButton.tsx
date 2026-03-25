
import React from "react";
import { useAuth } from "./AuthContext";


const LogoutButton: React.FC = () => {
    const { logout } = useAuth();

    const handleLogout = () => {
        logout(); // Limpia token y redirige
    };

    return (
        <button onClick={handleLogout}>
            Cerrar sesión
        </button>
    );
};

export default LogoutButton;