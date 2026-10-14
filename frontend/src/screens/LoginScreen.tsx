import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TaskNetLogo } from '../components/commonWidgets';
import { Icon } from '../components/ui/Icon';
import { ElevatedButton, InkWell, Tap } from '../components/ui/buttons';
import { TextField } from '../components/ui/inputs';
import { CircularProgressIndicator } from '../components/ui/misc';
import { Dialog, showDialog } from '../components/ui/overlay';
import { errorMessage } from '../services/apiService';
import { useAppState } from '../services/appState';
import { AppTheme, ts, tsField, tsPlain } from '../theme/appTheme';

function roleLabel(r: string): string {
  switch (r) {
    case 'admin': return 'Administrator';
    case 'principal': return 'Principal';
    case 'coordinator': return 'Coordinator';
    case 'dean': return 'Dean';
    case 'teacher': return 'Teacher';
    case 'registrar': return 'Registrar';
    default: return r;
  }
}

function pickRole(roles: string[]): Promise<string | undefined> {
  return showDialog<string>((pop) => (
    <Dialog radius={16}>
      <View style={{ width: 320, maxWidth: '100%', padding: 24, alignItems: 'flex-start' }}>
        <Text style={ts({ size: 18, weight: 700, color: '#1A1A2E' })}>Log in as</Text>
        <View style={{ height: 4 }} />
        <Text style={ts({ size: 12, color: '#6B7280' })}>
          This account has more than one role. Choose which to use.
        </Text>
        <View style={{ height: 16 }} />
        {roles.map((r) => (
          <View key={r} style={{ paddingBottom: 10, alignSelf: 'stretch' }}>
            <InkWell onPress={() => pop(r)} radius={10}>
              <View style={styles.roleOption}>
                <Icon name="badge_outlined" size={18} color="#1A1A2E" />
                <View style={{ width: 12 }} />
                <Text style={ts({ size: 14, weight: 600, color: '#1A1A2E' })}>{roleLabel(r)}</Text>
                <View style={{ flex: 1 }} />
                <Icon name="chevron_right" size={18} color="#94A3B8" />
              </View>
            </InkWell>
          </View>
        ))}
      </View>
    </Dialog>
  ));
}

export default function LoginScreen() {
  const state = useAppState();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const passRef = useRef<TextInput>(null);

  const login = async () => {
    setError(null);
    try {
      const roles = await state.login(username.trim(), password);
      // Single-role accounts log in directly (roles == null). Multi-role accounts
      // return their available roles — prompt for which identity to log in as.
      if (roles != null && roles.length > 0) {
        const chosen = await pickRole(roles);
        if (chosen == null) return; // cancelled
        await state.login(username.trim(), password, chosen);
      }
      // The root layout redirects to /dashboard once the user is signed in.
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <LinearGradient
      colors={['#C8D5EA', '#A8BCD6', '#D4E0F0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo row */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TaskNetLogo size={36} />
            <View style={{ width: 10 }} />
            <Text style={ts({ size: 18, weight: 800, color: AppTheme.textPrimary })}>TaskNet</Text>
          </View>
          <View style={{ height: 28 }} />

          {/* Title */}
          <Text style={ts({ size: 28, weight: 800, color: AppTheme.textPrimary, align: 'center' })}>Sign in</Text>
          <View style={{ height: 28 }} />

          {/* Session-expired notice (your work was auto-saved as a draft) */}
          {state.sessionExpired && (
            <>
              <View style={styles.expired}>
                <Icon name="info_outline" size={16} color="#B45309" />
                <View style={{ width: 8 }} />
                <Text style={[ts({ size: 12, color: '#B45309' }), { flex: 1 }]}>
                  Your session expired. Any in-progress event was saved as a draft.
                </Text>
              </View>
              <View style={{ height: 16 }} />
            </>
          )}

          {/* Username */}
          <InputBox
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            onSubmit={() => passRef.current?.focus()}
            suffix={<Icon name="person_outline" size={20} color={AppTheme.textLight} />}
          />
          <View style={{ height: 12 }} />

          {/* Password */}
          <InputBox
            inputRef={passRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            obscure={obscure}
            onSubmit={login}
            suffix={
              <Tap onPress={() => setObscure((v) => !v)}>
                <Icon
                  name={obscure ? 'visibility_outlined' : 'visibility_off_outlined'}
                  size={20}
                  color={AppTheme.textLight}
                />
              </Tap>
            }
          />
          <View style={{ height: 8 }} />

          {/* Error */}
          {error != null && (
            <View style={{ paddingBottom: 8 }}>
              <Text style={ts({ size: 13, color: AppTheme.redColor, align: 'center' })}>{error}</Text>
            </View>
          )}

          {/* Login Button */}
          <ElevatedButton
            onPress={state.isLoading ? null : login}
            backgroundColor={AppTheme.darkBanner}
            foregroundColor="#FFFFFF"
            padding={[0, 16]}
            radius={10}
            textStyle={tsPlain({ size: 16, weight: 700 })}
          >
            {state.isLoading ? <CircularProgressIndicator size={20} strokeWidth={2} color="#FFFFFF" /> : 'Log In'}
          </ElevatedButton>
          <View style={{ height: 12 }} />

          {/* Forgot password */}
          <Tap onPress={() => {}}>
            <Text style={ts({ size: 13, color: AppTheme.textMuted, align: 'center' })}>Forgot password?</Text>
          </Tap>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function InputBox({ value, onChangeText, placeholder, obscure = false, suffix, onSubmit, inputRef }: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  obscure?: boolean;
  suffix?: React.ReactNode;
  onSubmit?: () => void;
  inputRef?: React.Ref<TextInput>;
}) {
  return (
    <View style={styles.inputBox}>
      <TextField
        style={{ flex: 1 }}
        inputRef={inputRef}
        value={value}
        onChangeText={onChangeText}
        obscureText={obscure}
        textStyle={tsField({ size: 15 })}
        returnKeyType={onSubmit != null ? 'next' : 'done'}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        decoration={{
          hintText: placeholder,
          hintStyle: tsField({ size: 15, color: AppTheme.textLight }),
          border: 'none',
          filled: false,
          isDense: true,
          contentPadding: [0, 12],
        }}
      />
      {suffix}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 400,
    maxWidth: '100%',
    padding: 36,
    backgroundColor: AppTheme.bgColor,
    borderRadius: 20,
    boxShadow: AppTheme.shadowLg,
  },
  expired: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: AppTheme.amberBg,
    borderRadius: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
});
