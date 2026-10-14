import React from 'react';
import { Task } from '../models/models';
import CreateTaskScreen from './CreateTaskScreen';

/// Editing a task uses the Create Task form, opened on the task's values.
export default function EditTaskScreen({ task, onClose }: { task: Task; onClose: (updated?: boolean) => void }) {
  return <CreateTaskScreen editTask={task} onClose={onClose} />;
}
