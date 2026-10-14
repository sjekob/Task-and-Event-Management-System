import { useRouter } from 'expo-router';
import React from 'react';
import MyTasksScreen from '../../../screens/MyTasksScreen';

export default function Route() {
  const router = useRouter();
  return <MyTasksScreen category="common" onSelectTask={(id) => router.push(`/my-tasks/${id}`)} />;
}
