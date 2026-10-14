import { useRouter } from 'expo-router';
import React from 'react';
import TaskManagerScreen from '../../../screens/TaskManagerScreen';

export default function Route() {
  const router = useRouter();
  return (
    <TaskManagerScreen
      category="common"
      onCreateTask={() => router.push('/tasks/new')}
      onSelectTask={(id) => router.push(`/tasks/${id}`)}
    />
  );
}
