import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { roleLabel, useSession, type Role } from '@tasknet/shared';
import { Button, Field, Gap, T } from '@/components/ui';
import { colors, radius } from '@/theme';

export default function LoginScreen() {
  const { login, sessionExpired } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (role?: Role) => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Multi-role accounts get their roles back and pick one to log in as.
      const choices = await login(username.trim(), password, role);
      setRoles(choices && choices.length ? choices : null);
    } catch (e) {
      setRoles(null);
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.dark }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Image source={require('@/assets/images/logo.png')} style={{ width: 84, height: 84 }} resizeMode="contain" />
            <T style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 12 }}>TaskNet</T>
            <T style={{ color: '#9CA3AF', marginTop: 2 }}>Task and Event Management System</T>
          </View>
          <View style={styles.card}>
            {roles ? (
              <>
                <T v="h2">Log in as…</T>
                <T v="muted">This account holds several roles. Choose one for this session.</T>
                <Gap size={4} />
                {roles.map((r) => (
                  <Pressable key={r} onPress={() => void submit(r)} disabled={busy} accessibilityRole="button"
                    style={({ pressed }) => [styles.role, pressed && { backgroundColor: '#F3F4F6' }]}>
                    <T v="h3">{roleLabel(r)}</T>
                  </Pressable>
                ))}
                <Button title="Back" kind="ghost" onPress={() => setRoles(null)} />
              </>
            ) : (
              <>
                <T v="h2">Welcome back</T>
                {sessionExpired && <T v="small" style={{ color: colors.amber }}>Your session expired. Please log in again.</T>}
                <Field label="Username" placeholder="Username" autoCapitalize="none" autoCorrect={false}
                  autoComplete="username" textContentType="username" value={username} onChangeText={setUsername} returnKeyType="next" />
                <Field label="Password" placeholder="Password" secureTextEntry autoComplete="password" textContentType="password"
                  value={password} onChangeText={setPassword} returnKeyType="go" onSubmitEditing={() => void submit()} />
                {error && <T v="small" style={{ color: colors.red }}>{error}</T>}
                <Button title="Log In" onPress={() => void submit()} loading={busy} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 20, gap: 14, width: '100%', maxWidth: 440, alignSelf: 'center' },
  role: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14 },
});
