import { ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatherName, Icon } from './icons';
import { T } from './text';
import { C } from './theme';

/**
 * A full dialog: title bar, scrollable body and a footer of actions. Slides up
 * from the bottom and takes most of the screen on phones.
 */
export function Modal({ title, subtitle, onClose, children, footer, icon, locked, scroll = true }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode;
  icon?: FeatherName; locked?: boolean; scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible transparent animationType="slide" onRequestClose={locked ? undefined : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }} onPress={locked ? undefined : onClose} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '92%', paddingBottom: Math.max(insets.bottom, 12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: C.border }}>
            {icon && <View style={{ marginTop: 2 }}><Icon name={icon} size={20} /></View>}
            <View style={{ flex: 1 }}>
              {typeof title === 'string' ? <T size={17} weight={700}>{title}</T> : title}
              {subtitle ? (typeof subtitle === 'string' ? <T size={12.5} color={C.muted}>{subtitle}</T> : subtitle) : null}
            </View>
            {!locked && <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Icon name="x" size={22} color={C.muted} /></Pressable>}
          </View>
          {scroll
            ? <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            : <View style={{ padding: 16, gap: 12, flexShrink: 1 }}>{children}</View>}
          {footer ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/** A light bottom sheet (pickers, menus). */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' }} onPress={onClose} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginBottom: 12 }} />
        {title ? <T size={15} weight={700} style={{ marginBottom: 6 }}>{title}</T> : null}
        {children}
      </View>
    </RNModal>
  );
}

export interface MenuItem { label: string; icon?: FeatherName; onPress: () => void; danger?: boolean; disabled?: boolean }

/** A "more actions" button that opens a sheet of actions. */
export function ActionMenu({ items, icon = 'more-vertical' }: { items: MenuItem[]; icon?: FeatherName }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel="More actions" style={{ padding: 6 }}>
        <Icon name={icon} size={20} color={C.muted} />
      </Pressable>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          {items.map((it) => (
            <Pressable key={it.label} disabled={it.disabled} onPress={() => { setOpen(false); it.onPress(); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, opacity: it.disabled ? 0.4 : 1, backgroundColor: pressed ? C.surface2 : 'transparent' })}>
              {it.icon && <Icon name={it.icon} size={19} color={it.danger ? C.red : C.text} />}
              <T weight={500} color={it.danger ? C.red : C.text}>{it.label}</T>
            </Pressable>
          ))}
        </Sheet>
      )}
    </>
  );
}
