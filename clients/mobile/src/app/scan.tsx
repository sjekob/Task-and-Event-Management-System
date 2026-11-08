import { RequireAuth } from '../core/RequireAuth';
import QrScannerScreen from '../views/events/QrScannerScreen';

export default function Route() {
  return <RequireAuth><QrScannerScreen /></RequireAuth>;
}
