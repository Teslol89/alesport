import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import "./CustomStyles.css";

interface CustomToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
  type?: "success" | "danger" | "info";
  duration?: number; // en ms
  placement?: "top" | "center";
}

const CustomToast: React.FC<CustomToastProps> = ({ message, show, onClose, type = "danger", duration = 3000, placement = "top" }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onClose, duration]);
  if (!show) return null;
  return createPortal(
    <div className={`custom-toast custom-toast--${type} custom-toast--${placement}`}>
      <span>{message}</span>
    </div>,
    document.body
  );
};

export default CustomToast;
