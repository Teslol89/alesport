import React from "react";
import "./CustomToast.css";

interface CustomToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
  type?: "success" | "danger" | "info";
}

const CustomToast: React.FC<CustomToastProps> = ({ message, show, onClose, type = "danger" }) => {
  if (!show) return null;
  return (
    <div className={`custom-toast custom-toast--${type}`}> 
      <span>{message}</span>
      <button className="custom-toast__close" onClick={onClose} aria-label="Cerrar">&times;</button>
    </div>
  );
};

export default CustomToast;
