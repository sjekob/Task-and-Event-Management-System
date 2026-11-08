import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../core/AppModel';
import { C, Spinner } from '../ui/kit';

/** Start-up: wait for the stored session, then the dashboard or the login. */
export default function Index() {
  const { user, restoring } = useSession();
  if (restoring) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><Spinner /></View>;
  return <Redirect href={user ? '/dashboard' : '/login'} />;
}
