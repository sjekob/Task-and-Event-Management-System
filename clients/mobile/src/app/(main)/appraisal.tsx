import { RequireAuth } from '../../core/RequireAuth';
import AppraisalScreen from '../../views/appraisal/AppraisalScreen';

export default function Route() {
  return <RequireAuth perm="view_appraisal"><AppraisalScreen /></RequireAuth>;
}
