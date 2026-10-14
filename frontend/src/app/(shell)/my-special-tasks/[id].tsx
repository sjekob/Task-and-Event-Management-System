import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import TaskDetailScreen from '../../../screens/TaskDetailScreen';

export default function Route() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <TaskDetailScreen
      key={id}
      taskId={parseInt(id, 10)}
      onBack={() => router.push('/my-special-tasks')}
      ownTaskView
    />
  );
}
