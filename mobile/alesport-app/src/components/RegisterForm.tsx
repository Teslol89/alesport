import React, { useState } from "react";
import "./RegisterForm.css";

const RegisterForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí irá la lógica de registro
    alert("Registro enviado");
  };

  return (
    <div className="register-container">
      <h2 className="register-title">Crear cuenta</h2>
      <p className="register-description">Introduce tu nombre, correo electrónico y contraseña para crear una cuenta.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="register-input"
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="register-input"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="register-input"
        />
        <button type="submit" className="register-btn">Crear cuenta</button>
      </form>
    </div>
  );
};

export default RegisterForm;
