import { RequireAuth } from '../../../../core/RequireAuth';
import EvaluationScreen from '../../../../views/events/EvaluationScreen';

export default function Route() {
  return <RequireAuth><EvaluationScreen /></RequireAuth>;
}
