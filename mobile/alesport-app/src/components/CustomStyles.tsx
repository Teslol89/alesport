import React, { useEffect } from "react";
import "./CustomStyles.css";

interface CustomToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
  type?: "success" | "danger" | "info";
  duration?: number; // en ms
}

const CustomToast: React.FC<CustomToastProps> = ({ message, show, onClose, type = "danger", duration = 3000 }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onClose, duration]);
  if (!show) return null;
  return (
    <div className={`custom-toast custom-toast--${type}`}> 
      <span>{message}</span>
    </div>
  );
};

export default CustomToast;
