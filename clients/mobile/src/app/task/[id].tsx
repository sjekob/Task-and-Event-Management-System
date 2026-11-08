import { RequireAuth } from '../../core/RequireAuth';
import TaskDetailScreen from '../../views/tasks/TaskDetailScreen';

export default function Route() {
  return <RequireAuth><TaskDetailScreen /></RequireAuth>;
}
