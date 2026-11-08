import { RequireAuth } from '../../core/RequireAuth';
import ProfileScreen from '../../views/profile/ProfileScreen';

export default function Route() {
  return <RequireAuth><ProfileScreen /></RequireAuth>;
}
