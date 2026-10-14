import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import EventManagementScreen from '../../../screens/EventManagementScreen';

export default function Route() {
  const router = useRouter();
  const params = useLocalSearchParams<{ open?: string }>();
  const parsed = parseInt(params.open ?? '', 10);
  const open = isNaN(parsed) ? null : parsed;
  return (
    <EventManagementScreen
      // New key per requested event so a second dashboard click re-opens.
      key={`events-${open}`}
      onAddEvent={() => router.push('/events/new')}
      openEventId={open}
    />
  );
}
