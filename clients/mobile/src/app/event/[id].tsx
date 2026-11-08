import { RequireAuth } from '../../core/RequireAuth';
import EventDetailScreen from '../../views/events/EventDetailScreen';

export default function Route() {
  return <RequireAuth><EventDetailScreen /></RequireAuth>;
}
