# Estructura recomendada para el panel de administración (agenda/calendario)

src/
├── components/
│   ├── Calendar.tsx           # Componente principal de calendario/agenda
│   ├── SessionCard.tsx        # Tarjeta para mostrar info de una sesión
│   ├── SessionModal.tsx       # Modal para ver/editar detalles de sesión
│   ├── BookingList.tsx        # Lista de reservas para una sesión
│   └── ...
├── pages/
│   ├── AdminCalendarPage.tsx  # Página principal del panel admin (agenda)
│   └── ...
├── api/
│   ├── sessions.ts            # Lógica para llamar a /api/sessions
│   ├── bookings.ts            # Lógica para llamar a /api/bookings
│   └── ...
└── theme/
    └── ...

# Diagrama UI (inspirado en tus imágenes)

- Barra superior: logo, usuario, logout
- Filtros: fecha, entrenador, estado
- Calendario/agenda: vista semanal/día
- Lista de sesiones por día
    - Cada sesión: SessionCard (hora, estado, aforo, acciones)
    - Click: abre SessionModal con detalles y reservas (BookingList)
- Botón para crear nueva sesión

# Siguiente paso
- Crear los componentes base (Calendar, SessionCard, SessionModal) con datos mock.
- Integrar el endpoint /api/sessions/ en CalendarPage.
- Ajustar estilos según tus imágenes de referencia.