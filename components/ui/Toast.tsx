import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { font } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

interface ToastState {
  msg: string | null;
  anim: Animated.Value;
}
const ToastStateCtx = createContext<ToastState | null>(null);

// The toast lives in the app root, which an open Sheet's Modal is presented
// above — so Sheet renders a second ToastOverlay inside its Modal. Both read the
// same message and the same Animated.Value; the one on top is the one seen.
export function ToastOverlay() {
  const { theme } = useTheme();
  const state = useContext(ToastStateCtx);
  if (state == null || state.msg == null) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: theme.surface2,
          borderColor: theme.divider,
          opacity: state.anim,
          transform: [{ translateY: state.anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.text, { color: theme.text }]}>
        {state.msg}
      </Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(m);
      // accessibilityLiveRegion is Android-only; announce explicitly for iOS VoiceOver.
      AccessibilityInfo.announceForAccessibility(m);
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
          ({ finished }) => finished && setMsg(null)
        );
      }, 2600);
    },
    [anim]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const state = useMemo<ToastState>(() => ({ msg, anim }), [msg, anim]);

  return (
    <ToastCtx.Provider value={show}>
      <ToastStateCtx.Provider value={state}>
        {children}
        <ToastOverlay />
      </ToastStateCtx.Provider>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 52,
    alignSelf: 'center',
    maxWidth: 330,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { fontSize: 12.5, fontFamily: font.regular },
});
