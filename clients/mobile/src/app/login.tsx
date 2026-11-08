import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { LoginController } from '@shared/controllers/LoginController';
import { Navigation } from '@shared/controllers/Navigation';
import { useApp, useSession } from '../core/AppModel';
import { useScreenController } from '../core/hooks';
import { Button, C, FONT, Icon, Modal, T, shadow } from '../ui/kit';

/** Sign in (with a role choice for accounts that hold several roles). */
export default function Login() {
  const app = useApp();
  const { user, sessionExpired } = useSession();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [c, s] = useScreenController(() => new LoginController(app.session));
  const [focus, setFocus] = useState<'u' | 'p' | null>(null);

  if (user) return <Redirect href={(from && from.startsWith('/') ? from : '/dashboard') as never} />;

  const box = (on: boolean) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, borderWidth: 1.4, borderColor: on ? C.accent : C.borderStrong,
    borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fff',
  });
  const input = { flex: 1, paddingVertical: 14, fontFamily: FONT[400], fontSize: 15, color: C.text };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={[{ backgroundColor: '#fff', borderRadius: 18, padding: 24, gap: 14, maxWidth: 440, width: '100%', alignSelf: 'center' }, shadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={require('../../assets/images/tasknet-logo.png')} style={{ width: 36, height: 36 }} />
            <T size={18} weight={800}>TaskNet</T>
          </View>
          <T size={24} weight={800}>Sign in</T>
          {sessionExpired && (
            <View style={{ flexDirection: 'row', gap: 8, backgroundColor: C.amberBg, borderRadius: 10, padding: 12 }}>
              <Icon name="info" size={16} color={C.amberDark} />
              <T size={13} color={C.amberDark} style={{ flex: 1 }}>Your session expired. Any in-progress event was saved as a draft.</T>
            </View>
          )}
          <View style={box(focus === 'u')}>
            <TextInput style={input} placeholder="Username" placeholderTextColor={C.light} autoCapitalize="none" autoCorrect={false}
              value={s.username} onChangeText={(v) => c.setUsername(v)} onFocus={() => setFocus('u')} onBlur={() => setFocus(null)}
              returnKeyType="next" textContentType="username" />
            <Icon name="user" size={20} color={C.light} />
          </View>
          <View style={box(focus === 'p')}>
            <TextInput style={input} placeholder="Password" placeholderTextColor={C.light} secureTextEntry={!s.showPassword}
              value={s.password} onChangeText={(v) => c.setPassword(v)} onFocus={() => setFocus('p')} onBlur={() => setFocus(null)}
              returnKeyType="go" onSubmitEditing={() => void c.submit()} textContentType="password" />
            <Pressable onPress={() => c.toggleShowPassword()} hitSlop={8} accessibilityLabel={s.showPassword ? 'Hide password' : 'Show password'}>
              <Icon name={s.showPassword ? 'eye-off' : 'eye'} size={20} color={C.light} />
            </Pressable>
          </View>
          {s.error ? <T size={13} color={C.red}>{s.error}</T> : null}
          <Button size="lg" block loading={s.submitting} onPress={() => void c.submit()}>Log In</Button>
          <T size={12} color={C.muted} center>Forgot password? Ask the registrar to reset it.</T>
        </View>
      </ScrollView>
      {s.roleChoices && (
        <Modal title="Log in as" subtitle="This account has more than one role. Choose which to use." onClose={() => c.cancelRoleChoice()}>
          {s.roleChoices.map((r) => (
            <Button key={r} variant="outline-muted" block onPress={() => void c.submit(r)} style={{ justifyContent: 'flex-start', paddingVertical: 14 }}>
              {Navigation.roleTitle(r)}
            </Button>
          ))}
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}
