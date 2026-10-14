import { useState, type FormEvent } from 'react';
import {
  Alert, Box, Button, Center, Group, Image, Modal, Paper, PasswordInput, Stack, Text, TextInput, Title,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronRight, IconId, IconInfoCircle, IconUser } from '@tabler/icons-react';
import { roleLabel, useSession, type Role } from '@tasknet/shared';
import { colors } from '../theme';

export function LoginPage() {
  const { login, sessionExpired } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<Role[] | null>(null);

  const signIn = async (role?: Role) => {
    setError(null);
    setBusy(true);
    try {
      // Multi-role accounts get their roles back and pick one to log in as.
      const choices = await login(username.trim(), password, role);
      setRoles(choices && choices.length ? choices : null);
    } catch (e) {
      setRoles(null);
      setError(e instanceof Error ? e.message : 'Invalid username or password');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void signIn();
  };

  return (
    <Center mih="100dvh" p="md" style={{ background: 'linear-gradient(135deg, #C8D5EA, #A8BCD6 50%, #D4E0F0)' }}>
      <Paper w="100%" maw={400} p={36} radius={20} shadow="xl" bg={colors.bg}>
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <Group gap={10}>
              <Image src="/logo.png" w={36} h={36} fit="contain" alt="" />
              <Text fw={800} size="lg">TaskNet</Text>
            </Group>
            <Title order={1} ta="center" fz={28} fw={800} my="md">Sign in</Title>

            {sessionExpired && (
              <Alert color="yellow" icon={<IconInfoCircle size={16} />} p="sm">
                Your session expired. Any in-progress event was saved as a draft.
              </Alert>
            )}

            <TextInput
              size="md" placeholder="Username" autoComplete="username" autoFocus
              value={username} onChange={(e) => setUsername(e.currentTarget.value)}
              rightSection={<IconUser size={18} color={colors.textLight} />}
              aria-label="Username"
            />
            <PasswordInput
              size="md" placeholder="Password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.currentTarget.value)}
              aria-label="Password"
            />
            {error && <Text c="red" size="sm" ta="center">{error}</Text>}
            <Button type="submit" size="md" color="ink.8" loading={busy} disabled={!username || !password}>
              Log In
            </Button>
          </Stack>
        </form>
      </Paper>

      <Modal opened={!!roles} onClose={() => setRoles(null)} title="Log in as" size="sm">
        <Text size="xs" c="dimmed" mb="md">This account has more than one role. Choose which to use.</Text>
        <Stack gap={10}>
          {roles?.map((r) => (
            <UnstyledButton key={r} onClick={() => void signIn(r)} disabled={busy}
              style={{ border: '1px solid #CBD5E1', borderRadius: 10, background: '#F8FAFC' }}>
              <Group px={16} py={14} justify="space-between">
                <Group gap={12}>
                  <IconId size={18} />
                  <Text size="sm" fw={600}>{r === 'admin' ? 'Administrator' : roleLabel(r)}</Text>
                </Group>
                <Box c="#94A3B8"><IconChevronRight size={18} /></Box>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </Modal>
    </Center>
  );
}
