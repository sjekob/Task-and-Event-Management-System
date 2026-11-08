import { RequireAuth } from '../../core/RequireAuth';
import EventsScreen from '../../views/events/EventsScreen';

export default function Route() {
  return <RequireAuth><EventsScreen /></RequireAuth>;
}
