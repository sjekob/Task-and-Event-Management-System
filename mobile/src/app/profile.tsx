import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, flag, qk, useSession, type User } from '@tasknet/shared';
import { PersonDetails } from '@/components/PersonDetails';
import { Button, Card, ErrorView, Field, Loading, notifyError, notifySuccess, Row, Screen, SectionHeader, T } from '@/components/ui';

export default function ProfileScreen() {
  const profile = useQuery({ queryKey: qk.profile, queryFn: api.users.myProfile });
  const [editing, setEditing] = useState(false);

  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={() => profile.refetch()} />;
  return (
    <Screen onRefresh={() => profile.refetch()}>
      {editing ? <EditProfile u={profile.data} onClose={() => setEditing(false)} />
        : <PersonDetails u={profile.data}
          header={<Button title="Edit details" kind="outline" small icon="create-outline" onPress={() => setEditing(true)} style={{ marginTop: 6 }} />} />}
      {!editing && <T v="small" style={{ textAlign: 'center' }}>Skills, education and certificate uploads are edited in the TaskNet web app.</T>}
    </Screen>
  );
}

function EditProfile({ u, onClose }: { u: User; onClose: () => void }) {
  const qc = useQueryClient();
  const { refresh } = useSession();
  const [f, setF] = useState({
    first_name: u.first_name ?? '', middle_name: u.middle_name ?? '', last_name: u.last_name ?? '', suffix: u.suffix ?? '',
    email: u.email ?? '', phone_number: u.phone_number ?? '', address: u.address ?? '',
    number_of_children: String(u.number_of_children ?? 0),
  });
  const [care, setCare] = useState(flag(u.has_elderly_or_infant_care));
  const [overtime, setOvertime] = useState(flag(u.overtime_opt_in));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        number_of_children: Math.max(0, Number(f.number_of_children) || 0),
        has_elderly_or_infant_care: care,
        overtime_opt_in: overtime,
      };
      for (const k of ['first_name', 'middle_name', 'last_name', 'suffix', 'email', 'phone_number', 'address'] as const) {
        const v = f[k].trim();
        if (v) body[k] = v;
      }
      await api.users.updateMyProfile(body);
      await Promise.all([qc.invalidateQueries({ queryKey: qk.profile }), refresh()]);
      notifySuccess('Profile updated');
      onClose();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader title="Name" />
      <Card style={{ gap: 12 }}>
        <Field label="First name" value={f.first_name} onChangeText={set('first_name')} />
        <Field label="Middle name" value={f.middle_name} onChangeText={set('middle_name')} />
        <Field label="Last name" value={f.last_name} onChangeText={set('last_name')} />
        <Field label="Suffix" value={f.suffix} onChangeText={set('suffix')} placeholder="Jr., III" />
      </Card>
      <SectionHeader title="Contact" />
      <Card style={{ gap: 12 }}>
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone" value={f.phone_number} onChangeText={set('phone_number')} keyboardType="phone-pad" />
        <Field label="Address" value={f.address} onChangeText={set('address')} multiline />
      </Card>
      <SectionHeader title="Workload context" />
      <Card style={{ gap: 12 }}>
        <Field label="Number of children" value={f.number_of_children} onChangeText={set('number_of_children')} keyboardType="number-pad" />
        <Row style={{ justifyContent: 'space-between' }}>
          <T style={{ flex: 1 }}>Caring for an elderly family member or infant</T>
          <Switch value={care} onValueChange={setCare} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T style={{ flex: 1 }}>Open to overtime / weekend tasks</T>
          <Switch value={overtime} onValueChange={setOvertime} />
        </Row>
      </Card>
      <View style={{ gap: 8, marginTop: 16 }}>
        <Button title="Save changes" icon="checkmark" loading={saving} onPress={() => void save()} />
        <Button title="Cancel" kind="outline" onPress={onClose} />
      </View>
    </>
  );
}
