import { useRouter } from 'expo-router';
import React from 'react';
import AddEventScreen from '../../../screens/AddEventScreen';

export default function Route() {
  const router = useRouter();
  return <AddEventScreen onBack={() => router.push('/events')} onCreated={() => router.push('/events')} />;
}
