import { RequireAuth } from '../../core/RequireAuth';
import ActivityScreen from '../../views/activity/ActivityScreen';

export default function Route() {
  return <RequireAuth><ActivityScreen /></RequireAuth>;
}
