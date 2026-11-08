import { RequireAuth } from '../../../../core/RequireAuth';
import AttendanceScanScreen from '../../../../views/events/AttendanceScanScreen';

export default function Route() {
  return <RequireAuth><AttendanceScanScreen /></RequireAuth>;
}
