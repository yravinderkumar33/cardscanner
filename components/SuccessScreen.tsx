import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ContactFields } from '../lib/schema';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { Btn } from './ui/Btn';
import { CheckCircle, LockSimple } from './ui/icons';

// Save-success screen from the prototype (screen 05): quiet confirmation that
// owns the return from the native contact-form detour. Theme-aware.

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function SuccessScreen({
  fields,
  onScanAnother,
  onViewHistory,
}: {
  fields: ContactFields;
  onScanAnother(): void;
  onViewHistory(): void;
}) {
  const { theme } = useTheme();

  // ── Animations: kfFade root, kfPop frame, checkmark draw, glow pulse ──────
  const fadeIn = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(0.7)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const dash = useRef(new Animated.Value(70)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(popScale, { toValue: 1.06, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(popScale, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
      Animated.timing(popOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    // strokeDashoffset is not native-driver animatable.
    Animated.timing(dash, {
      toValue: 0,
      duration: 500,
      delay: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    Animated.timing(cardIn, {
      toValue: 1,
      duration: 400,
      delay: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const glowTimer = setTimeout(() => glowLoop.start(), 600);
    return () => {
      clearTimeout(glowTimer);
      glowLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Contact chip content ──────────────────────────────────────────────────
  const initialsRaw =
    `${fields.firstName?.[0] ?? ''}${fields.lastName?.[0] ?? ''}` ||
    (fields.company ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('');
  const initials = (initialsRaw || '?').toUpperCase();
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ') || fields.company || 'New contact';
  const sub = [fields.jobTitle, fields.company].filter(Boolean).join(' · ');

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg, opacity: fadeIn }]}>
      {/* Soft accent halo at the top, from the prototype's radial gradient */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="halo" cx="50%" cy="20%" rx="85%" ry="45%">
            <Stop offset="0" stopColor={theme.dark ? '#423a6a' : theme.accent} stopOpacity={theme.dark ? 0.45 : 0.18} />
            <Stop offset="0.65" stopColor={theme.dark ? '#423a6a' : theme.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#halo)" />
      </Svg>

      {/* Corner-bracket frame + drawn checkmark */}
      <Animated.View style={[styles.frame, { opacity: popOpacity, transform: [{ scale: popScale }] }]}>
        <Animated.View
          style={[
            styles.frameGlow,
            {
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.26] }),
            },
          ]}
        />
        <View style={[styles.corner, styles.cornerTL, { borderColor: theme.accent }]} />
        <View style={[styles.corner, styles.cornerTR, { borderColor: theme.accent }]} />
        <View style={[styles.corner, styles.cornerBL, { borderColor: theme.accent }]} />
        <View style={[styles.corner, styles.cornerBR, { borderColor: theme.accent }]} />
        <Svg width={104} height={104} viewBox="0 0 104 104" style={StyleSheet.absoluteFill}>
          <AnimatedPath
            d="M32 54 L46 68 L72 40"
            fill="none"
            stroke={theme.accentBright}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={70}
            strokeDashoffset={dash}
          />
        </Svg>
      </Animated.View>

      {/* Copy */}
      <View style={styles.copyBlock}>
        <Text style={[styles.title, { color: theme.text }]}>Handed to Contacts</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Apple’s own form did the writing — CardScanner never touches your address book. If you
          tapped Cancel there, nothing was saved.
        </Text>
      </View>

      {/* Contact chip card */}
      <Animated.View
        style={[
          styles.contactCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.ring,
            shadowOpacity: theme.shadowOpacity * 0.5,
            opacity: cardIn,
            transform: [{ translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        <View style={[styles.initials, { backgroundColor: theme.accentTintStrong }]}>
          <Text style={[styles.initialsText, { color: theme.accentBright }]}>{initials}</Text>
        </View>
        <View style={styles.contactBody}>
          <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          {sub !== '' && (
            <Text style={[styles.contactSub, { color: theme.muted }]} numberOfLines={1}>
              {sub}
            </Text>
          )}
        </View>
        <CheckCircle size={20} color={theme.accentBright} />
      </Animated.View>

      {/* Local-only promise */}
      <View style={styles.lockRow}>
        <LockSimple size={13} color={theme.faint} />
        <Text style={[styles.lockText, { color: theme.faint }]}>A copy stays in History — on this phone only</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Btn label="Scan another card" onPress={onScanAnother} variant="primary" size="lg" />
        <Btn
          label="View in History"
          onPress={onViewHistory}
          variant="secondary"
          size="lg"
          style={{ paddingVertical: 12 }}
          textStyle={{ fontSize: 14 }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 28,
    gap: 17,
  },
  frame: { width: 104, height: 104 },
  frameGlow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 34,
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: { position: 'absolute', width: 26, height: 26 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  copyBlock: { alignItems: 'center' },
  title: {
    fontSize: 26,
    fontFamily: font.medium,
    letterSpacing: -0.52,
    marginBottom: 7,
    textAlign: 'center',
  },
  body: {
    fontSize: 13.5,
    fontFamily: font.regular,
    lineHeight: 21,
    maxWidth: 270,
    textAlign: 'center',
  },
  contactCard: {
    width: '100%',
    maxWidth: 310,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  initials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { fontSize: 15, fontFamily: font.medium },
  contactBody: { flex: 1, minWidth: 0 },
  contactName: { fontSize: 14.5, fontFamily: font.medium },
  contactSub: { fontSize: 12, fontFamily: font.regular, marginTop: 1 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockText: { fontSize: 11.5, fontFamily: font.regular },
  actions: { width: '100%', maxWidth: 310, gap: 8, marginTop: 4 },
});
