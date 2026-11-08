import { RequireAuth } from '../core/RequireAuth';
import TaskFormScreen from '../views/tasks/TaskFormScreen';

export default function Route() {
  return <RequireAuth perm="create_tasks"><TaskFormScreen /></RequireAuth>;
}
