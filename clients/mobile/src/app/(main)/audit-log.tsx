import { RequireAuth } from '../../core/RequireAuth';
import AuditLogScreen from '../../views/audit/AuditLogScreen';

export default function Route() {
  return <RequireAuth perm="view_audit"><AuditLogScreen /></RequireAuth>;
}
