import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';
import { Sheet } from './Sheet';

// Destructive-confirm action sheet from the prototype: title + body card with
// a danger action, and a separate Cancel card below.
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const { theme } = useTheme();
  return (
    <Sheet visible={visible} onClose={onCancel} floating>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={[styles.header, { borderBottomColor: theme.divider }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.action,
            pressed && { backgroundColor: theme.dark ? 'rgba(224,138,132,0.08)' : 'rgba(168,67,63,0.08)' },
          ]}
        >
          <Text style={[styles.actionText, { color: theme.danger }]}>{confirmLabel}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [
          styles.cancel,
          { backgroundColor: theme.surface, borderColor: theme.divider },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.actionText, { color: theme.text }]}>{cancelLabel}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  header: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13, alignItems: 'center', borderBottomWidth: 1 },
  title: { fontSize: 14.5, fontFamily: font.medium, marginBottom: 3, textAlign: 'center' },
  body: { fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  action: { paddingVertical: 13, alignItems: 'center' },
  actionText: { fontSize: 15, fontFamily: font.medium },
  cancel: { marginTop: 8, paddingVertical: 13, alignItems: 'center', borderRadius: 16, borderWidth: 1 },
});
