import { RequireAuth } from '../../core/RequireAuth';
import PersonnelScreen from '../../views/personnel/PersonnelScreen';

export default function Route() {
  return <RequireAuth perm="view_personnel"><PersonnelScreen /></RequireAuth>;
}
