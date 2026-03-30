import React, { useState } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButton, IonGrid, IonRow, IonCol } from '@ionic/react';
import './Calendar.css';

// Datos de ejemplo para sesiones
const mockSessions = [
  {
    id: 5,
    trainer: 'Ana',
    session_date: '2026-04-05',
    start_time: '08:00',
    end_time: '09:00',
    capacity: 7,
    status: 'completed',
  },
  {
    id: 6,
    trainer: 'Ana',
    session_date: '2026-04-05',
    start_time: '10:00',
    end_time: '11:00',
    capacity: 7,
    status: 'completed',
  },
  {
    id: 29,
    trainer: 'Ana',
    session_date: '2026-04-06',
    start_time: '08:30',
    end_time: '09:30',
    capacity: 7,
    status: 'active',
  },
  {
    id: 19,
    trainer: 'Ana',
    session_date: '2026-04-06',
    start_time: '10:00',
    end_time: '11:00',
    capacity: 7,
    status: 'completed',
  },
];

const Calendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('2026-04-05');

  // Filtra sesiones por fecha seleccionada
  const sessionsForDate = mockSessions.filter(s => s.session_date === selectedDate);

  return (
    <div>
      <h2>Agenda de sesiones</h2>
      <IonGrid>
        <IonRow>
          <IonCol>
            <IonButton onClick={() => setSelectedDate('2026-04-05')}>5 abril</IonButton>
          </IonCol>
          <IonCol>
            <IonButton onClick={() => setSelectedDate('2026-04-06')}>6 abril</IonButton>
          </IonCol>
        </IonRow>
      </IonGrid>
      <div>
        {sessionsForDate.length === 0 ? (
          <p>No hay sesiones para este día.</p>
        ) : (
          sessionsForDate.map(session => (
            <IonCard key={session.id} color={session.status === 'active' ? 'success' : 'medium'}>
              <IonCardHeader>
                <IonCardTitle>
                  {session.start_time} - {session.end_time} | {session.trainer}
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                Estado: {session.status} <br />
                Aforo: {session.capacity}
                <br />
                <IonButton size="small" color="primary">Ver detalles</IonButton>
              </IonCardContent>
            </IonCard>
          ))
        )}
      </div>
    </div>
  );
};

export default Calendar;
