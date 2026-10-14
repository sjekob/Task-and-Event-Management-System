import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import AddEventScreen from '../../../../screens/AddEventScreen';
import { takeRouteExtra } from '../../../../utils/routeExtra';

export default function Route() {
  const router = useRouter();
  // The event handed over by the list (the route extra), read once.
  const [existingEvent] = useState(takeRouteExtra);
  return (
    <AddEventScreen
      onBack={() => router.push('/events')}
      onCreated={() => router.push('/events')}
      existingEvent={existingEvent}
    />
  );
}
