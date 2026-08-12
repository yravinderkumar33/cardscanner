import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ToastOverlay } from './Toast';

// Bottom sheet with the prototype's kfSheet slide + kfFade scrim. `floating`
// renders detached rounded content (action-sheet style); default is a docked
// sheet with a grab handle.
export function Sheet({
  visible,
  onClose,
  children,
  floating = false,
  maxHeightPct = 0.72,
}: {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  floating?: boolean;
  maxHeightPct?: number;
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        easing: Easing.bezier(0.3, 1, 0.4, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
  }, [visible, anim]);

  if (!mounted) return null;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.scrim, { backgroundColor: theme.scrim, opacity: anim }]}>
        <Pressable style={styles.flex} accessibilityLabel="Close" onPress={onClose} />
        <Animated.View
          style={[
            floating
              ? styles.floating
              : [
                  styles.docked,
                  { backgroundColor: theme.surface, maxHeight: `${Math.round(maxHeightPct * 100)}%` },
                ],
            { transform: [{ translateY }] },
          ]}
        >
          {!floating && (
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: theme.dark ? 'rgba(233,233,237,0.22)' : 'rgba(41,43,49,0.22)' }]} />
            </View>
          )}
          {children}
        </Animated.View>
      </Animated.View>
      {/* The root-level toast is painted below this Modal, so repeat it here. */}
      <ToastOverlay />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  docked: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
  },
  floating: { marginHorizontal: 10, marginBottom: 12 },
  handleRow: { paddingTop: 9, alignItems: 'center' },
  handle: { width: 36, height: 4.5, borderRadius: 3 },
});
