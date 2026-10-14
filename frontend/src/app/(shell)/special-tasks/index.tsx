import { useRouter } from 'expo-router';
import React from 'react';
import TaskManagerScreen from '../../../screens/TaskManagerScreen';

export default function Route() {
  const router = useRouter();
  return (
    <TaskManagerScreen
      category="special"
      onCreateTask={() => router.push('/special-tasks/new')}
      onSelectTask={(id) => router.push(`/special-tasks/${id}`)}
    />
  );
}
