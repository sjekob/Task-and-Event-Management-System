import { RequireAuth } from '../../core/RequireAuth';
import SchoolYearsScreen from '../../views/schoolYears/SchoolYearsScreen';

export default function Route() {
  return <RequireAuth perm="manage_school_years"><SchoolYearsScreen /></RequireAuth>;
}
