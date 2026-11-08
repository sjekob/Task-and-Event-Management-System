import { View } from 'react-native';
import { ASSIGNABLE_ROLES, AddUserController, COORDINATOR_TYPE_GROUPS, EditRoleController } from '@shared/controllers/PersonnelControllers';
import { User } from '@shared/models';
import { Format } from '@shared/utils/format';
import { useServices } from '../../core/AppModel';
import { useScreenController } from '../../core/hooks';
import { Button, C, Check, DateField, Field, Icon, IconButton, Input, Loading, Modal, Row, Select, Switch, T } from '../../ui/kit';

// Add a user / edit role and assignment (principal, admin).
export function AddUserDialog({ onClose }: { onClose: (ok: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new AddUserController(services), []);
  return (
    <Modal title="Add New User" icon="user-plus" onClose={() => onClose(false)}
      footer={<><Button variant="ghost" onPress={() => onClose(false)}>Cancel</Button><Button disabled={!c.canSubmit} loading={s.saving} onPress={async () => { if (await c.submit()) onClose(true); }}>Create User</Button></>}>
      <Field label="Email" required><Input keyboardType="email-address" autoCapitalize="none" placeholder="Email" value={s.email} onChangeText={(v) => c.set({ email: v })} /></Field>
      <Field label="Username" required><Input autoCapitalize="none" placeholder="Username" value={s.username} onChangeText={(v) => c.set({ username: v })} /></Field>
      <Field label="Password" required help="Min. 6 characters" error={c.passwordError}>
        <Row>
          <Input style={{ flex: 1 }} secureTextEntry={!s.show} placeholder="Password" value={s.password} onChangeText={(v) => c.set({ password: v })} />
          <IconButton name={s.show ? 'eye' : 'eye-off'} label="Show password" onPress={() => c.toggleShow()} />
        </Row>
      </Field>
      {s.error ? <T size={13} color={C.red}>Error: {s.error}</T> : null}
    </Modal>
  );
}

export function EditRoleDialog({ user, onClose }: { user: User; onClose: (ok: boolean) => void }) {
  const services = useServices();
  const [c, s] = useScreenController(() => new EditRoleController(services, user), [user.id]);
  const gradeOptions = [{ value: null, label: '— None —' }, ...s.gradeLevels.map((g) => ({ value: g.id, label: g.name }))];
  const coordinatorOptions = Object.entries(COORDINATOR_TYPE_GROUPS).flatMap(([group, types]) => types.map((t) => ({ value: t, label: t, hint: group })));
  return (
    <Modal title="Edit Role & Assignment" icon="edit-2" onClose={() => onClose(false)}
      footer={<><Button variant="outline-muted" onPress={() => onClose(false)}>Cancel</Button><Button loading={s.saving} onPress={async () => { if (await c.submit()) onClose(true); }}>Save Changes</Button></>}>
      <T weight={700}>Role Assignment</T>
      <Field label="Administrative Role">
        <Select value={s.role} options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))} onChange={(v) => c.set({ role: v })} />
      </Field>
      <Field label="Date of Appointment"><DateField value={s.appointment || null} onChange={(v) => c.set({ appointment: v ?? '' })} /></Field>
      {s.role === 'dean' && s.gradeLevels.length > 0 && (
        <Field label="Grade Level Handled"><Select<number | null> value={s.deanGradeLevelId} options={gradeOptions} onChange={(v) => c.set({ deanGradeLevelId: v })} /></Field>
      )}
      {s.role === 'coordinator' && (
        <Field label="Coordinator Type"><Select<string | null> value={s.coordinatorType} placeholder="Select type" options={coordinatorOptions} onChange={(v) => c.set({ coordinatorType: v })} /></Field>
      )}
      {c.canAdvise && (
        <View style={{ gap: 8, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12 }}>
          <Row gap={12}>
            <View style={{ flex: 1 }}>
              <T size={13} weight={600}>Class adviser</T>
              <T size={12} color={C.muted}>Is this teacher the adviser of a class? Advisers get an Advisory tab with their class's tasks from the school calendar.</T>
            </View>
            <Switch value={s.isAdviser} onChange={(v) => c.set({ isAdviser: v })} />
          </Row>
          {s.isAdviser && (
            <Field label="Advisory class" help={s.sections.length ? undefined : 'No sections yet: add them with "Sections" on the Personnel page.'}>
              <Select<number | null> value={s.advisorySectionId} placeholder="Select section" options={c.advisoryOptions} onChange={(v) => c.set({ advisorySectionId: v })} />
            </Field>
          )}
        </View>
      )}
      <T weight={700} style={{ marginTop: 6 }}>Subjects and Sections Taught</T>
      {!s.metaLoaded ? <Loading /> : s.rows.map((r, i) => (
        <View key={i} style={{ gap: 8, padding: 10, backgroundColor: C.surface2, borderRadius: 10 }}>
          <Row><T size={12.5} weight={700} color={C.muted} style={{ flex: 1 }}>Assignment {i + 1}</T>
            {s.rows.length > 1 && <IconButton name="x" size={17} label="Remove row" color={C.red} onPress={() => c.removeRow(i)} />}</Row>
          <Select<number | null> value={r.gradeLevelId} placeholder="Grade level" options={gradeOptions} onChange={(v) => c.setRow(i, { gradeLevelId: v })} />
          <Select<string | null> value={r.subject} placeholder="Select subject" options={s.subjects.map((x) => ({ value: x, label: x }))} onChange={(v) => c.setRow(i, { subject: v })} />
          {r.subject && c.sectionsFor(r).length > 0 && (
            <View style={{ gap: 4 }}>
              <T size={12} color={C.muted}>Sections taught</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {c.sectionsFor(r).map((x) => (
                  <Check key={x.id} checked={r.sectionIds.includes(x.id)} label={r.gradeLevelId === null ? x.label : x.name} onChange={() => c.toggleSection(i, x.id)} />
                ))}
              </View>
            </View>
          )}
        </View>
      ))}
      <Button variant="ghost" size="sm" icon="plus" style={{ alignSelf: 'flex-start' }} onPress={() => c.addRow()}>Add Subject</Button>
      <Row gap={8} style={{ alignItems: 'flex-start', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 12 }}>
        <Icon name="lock" size={15} color={C.muted} />
        <T size={12} color="#374151" style={{ flex: 1 }}>Personal information — education, skills, certifications and family details — can only be edited by {user.fullName} in their own profile.</T>
      </Row>
      {s.error ? <T size={13} color={C.red}>Error: {s.error}</T> : null}
      <T size={11} color={C.light}>Appointment dates can't be in the future (today is {Format.longDate(new Date())}).</T>
    </Modal>
  );
}
