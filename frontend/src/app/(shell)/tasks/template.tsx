import { useRouter } from 'expo-router';
import React from 'react';
import CreateTaskScreen from '../../../screens/CreateTaskScreen';

export default function Route() {
  const router = useRouter();
  return (
    <CreateTaskScreen
      isTemplate
      onBack={() => router.push('/tasks')}
      onCreated={() => router.push('/tasks')}
    />
  );
}
