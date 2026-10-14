import { useRouter } from 'expo-router';
import React from 'react';
import CreateTaskScreen from '../../../screens/CreateTaskScreen';

export default function Route() {
  const router = useRouter();
  return (
    <CreateTaskScreen
      lockedCategory="special"
      onBack={() => router.push('/special-tasks')}
      onCreated={() => router.push('/special-tasks')}
    />
  );
}
