import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isActive, qk, useSession, useUser } from '@tasknet/shared';
import { PersonDetails } from '@/components/PersonDetails';
import { Button, confirm, ErrorView, Loading, notifyError, Screen } from '@/components/ui';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  const me = useUser();
  const { can } = useSession();
  const qc = useQueryClient();
  const person = useQuery({ queryKey: qk.person(personId), queryFn: () => api.personnel.get(personId) });

  if (person.isPending) return <Loading />;
  if (person.isError) return <ErrorView error={person.error} onRetry={() => person.refetch()} />;
  const u = person.data;
  const active = isActive(u);

  const toggle = async () => {
    const verb = active ? 'Deactivate' : 'Reactivate';
    if (!(await confirm(`${verb} account`, `${verb} ${u.full_name}'s account?`, verb, active))) return;
    try {
      await api.personnel.toggleStatus(u.id);
      await Promise.all([qc.invalidateQueries({ queryKey: qk.person(personId) }), qc.invalidateQueries({ queryKey: qk.allPersonnel })]);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: u.full_name }} />
      <Screen onRefresh={() => person.refetch()}>
        <PersonDetails u={u} header={can('deactivate_personnel') && u.id !== me.id ? (
          <Button title={active ? 'Deactivate account' : 'Reactivate account'} kind={active ? 'danger' : 'outline'} small
            icon={active ? 'ban-outline' : 'refresh-outline'} style={{ marginTop: 6 }} onPress={() => void toggle()} />
        ) : undefined} />
      </Screen>
    </>
  );
}
