import { RequireAuth } from '../core/RequireAuth';
import EventFormScreen from '../views/events/EventFormScreen';

export default function Route() {
  return <RequireAuth perm="manage_events"><EventFormScreen /></RequireAuth>;
}
