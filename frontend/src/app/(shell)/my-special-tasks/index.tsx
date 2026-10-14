import { useRouter } from 'expo-router';
import React from 'react';
import MyTasksScreen from '../../../screens/MyTasksScreen';

export default function Route() {
  const router = useRouter();
  return <MyTasksScreen category="special" onSelectTask={(id) => router.push(`/my-special-tasks/${id}`)} />;
}
