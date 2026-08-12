import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import appConfig from '../app.json';
import { historySizeBytes } from '../lib/historyStore';
import {
  formatBytes,
  llmSources,
  modelBytesOnDisk,
  modelInstalled,
  ocrSources,
  onModelsChanged,
} from '../lib/modelManager';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import type { Appearance } from '../theme/tokens';
import { Card, SectionLabel } from './ui/Card';
import { IconBadge } from './ui/IconBadge';
import { ScreenHeader } from './ui/ScreenHeader';
import { useToast } from './ui/Toast';
import {
  CaretRight,
  Check,
  CloudSlash,
  HardDrives,
  ShieldCheck,
  Translate,
  Warning,
} from './ui/icons';

const withAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

// kfPush entrance: fade + translateX 44 → 0 over 300 ms.
function usePushIn() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [anim]);
  return {
    opacity: anim,
    transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }],
  };
}

// Appearance preview tiles — colors are fixed by the design (they depict the
// two palettes), deliberately not themed.
const APPEARANCE_OPTIONS: {
  v: Appearance;
  label: string;
  bg: string;
  split?: boolean;
  bar1: string;
  bar2: string;
}[] = [
  {
    v: 'system',
    label: 'System',
    bg: '#161826',
    split: true,
    bar1: 'rgba(147,151,171,0.45)',
    bar2: 'rgba(147,151,171,0.35)',
  },
  { v: 'light', label: 'Light', bg: '#e4e7f5', bar1: '#f3f5fe', bar2: '#cfd3e5' },
  { v: 'dark', label: 'Dark', bg: '#161826', bar1: '#232532', bar2: '#2c2e3d' },
];

// Selected-tile check disc with the kfPop entrance (scale 0.7 → 1.06 → 1).
function CheckPop({ accent }: { accent: string }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scale]);
  return (
    <Animated.View style={[styles.checkDisc, { backgroundColor: accent, transform: [{ scale }] }]}>
      <Check size={11} color="#161826" />
    </Animated.View>
  );
}

// Segmented storage bar: OCR (accent) · LLM (45% accent) · scans (25% text).
// Only categories that actually hold bytes get a segment.
function StorageBar({
  ocr,
  llm,
  scans,
  height,
}: {
  ocr: number;
  llm: number;
  scans: number;
  height: number;
}) {
  const { theme } = useTheme();
  const total = ocr + llm + scans;
  const frac = (n: number) => (n > 0 ? Math.max(n / total, 0.02) : 0);
  return (
    <View
      style={[
        styles.bar,
        { height },
        total === 0 && { backgroundColor: withAlpha(theme.text, 0.09), borderRadius: 4 },
      ]}
    >
      <View
        style={{
          flexGrow: frac(ocr),
          flexBasis: 0,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
          backgroundColor: theme.accent,
        }}
      />
      <View
        style={{ flexGrow: frac(llm), flexBasis: 0, backgroundColor: withAlpha(theme.accent, 0.45) }}
      />
      <View
        style={{
          flexGrow: frac(scans),
          flexBasis: 0,
          borderTopRightRadius: 4,
          borderBottomRightRadius: 4,
          backgroundColor: withAlpha(theme.text, 0.25),
        }}
      />
    </View>
  );
}

export function SettingsScreen({
  onBack,
  onOpenModels,
  onOpenPrivacy,
  appearance,
  onSetAppearance,
}: {
  onBack(): void;
  onOpenModels(): void;
  onOpenPrivacy(): void;
  appearance: Appearance;
  onSetAppearance(a: Appearance): void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const pushIn = usePushIn();

  // Size stats are sync file I/O, so memoize them behind a tick instead of
  // re-reading on every render. Deleting a model on the Models screen (pushed
  // on top without remounting this one) emits onModelsChanged, which bumps
  // the tick and refreshes the numbers.
  const [tick, setTick] = useState(0);
  useEffect(() => onModelsChanged(() => setTick((n) => n + 1)), []);
  const { ocrBytes, llmBytes, scanBytes, bothInstalled } = useMemo(
    () => ({
      ocrBytes: modelBytesOnDisk(ocrSources()),
      llmBytes: modelBytesOnDisk(llmSources()),
      scanBytes: historySizeBytes(),
      bothInstalled: modelInstalled(ocrSources()) && modelInstalled(llmSources()),
    }),
    [tick]
  );

  const pressedBg = theme.dark ? 'rgba(233,233,237,0.04)' : 'rgba(41,43,49,0.04)';

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, pushIn]}>
      <ScreenHeader title="Settings" onBack={onBack} backLabel="Back to camera" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <SectionLabel>On-device AI</SectionLabel>
        <Card style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              bothInstalled ? 'AI models, both installed' : 'AI models, partly installed'
            }
            onPress={onOpenModels}
            style={({ pressed }) => [
              styles.modelsBlock,
              { borderBottomColor: theme.divider },
              pressed && { backgroundColor: pressedBg },
            ]}
          >
            <View style={styles.rowLine}>
              <IconBadge>
                <HardDrives size={16} color={theme.accentBright} />
              </IconBadge>
              <Text style={[styles.rowLabel, { color: theme.text }]}>AI models</Text>
              {bothInstalled ? (
                <View style={[styles.chip, { backgroundColor: theme.accentTint }]}>
                  <Check size={10} color={theme.accentBright} />
                  <Text style={[styles.chipText, { color: theme.accentBright }]}>
                    Both installed
                  </Text>
                </View>
              ) : (
                <View style={[styles.chip, { backgroundColor: withAlpha(theme.warning, 0.12) }]}>
                  <Warning size={10} color={theme.warning} />
                  <Text style={[styles.chipText, { color: theme.warning }]}>Partly installed</Text>
                </View>
              )}
              <CaretRight size={13} color={theme.faint} />
            </View>
            <StorageBar ocr={ocrBytes} llm={llmBytes} scans={scanBytes} height={6} />
            <View style={styles.storageCaption}>
              <Text
                numberOfLines={1}
                style={[styles.captionText, styles.captionLeft, { color: theme.muted }]}
              >
                OCR {formatBytes(ocrBytes)} · Language model {formatBytes(llmBytes)} · scans{' '}
                {formatBytes(scanBytes)}
              </Text>
              <Text style={[styles.captionText, { color: theme.muted }]}>
                {formatBytes(ocrBytes + llmBytes + scanBytes)}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="OCR language packs, English"
            onPress={() => toast('More OCR languages ship with a future pack.')}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: pressedBg }]}
          >
            <IconBadge>
              <Translate size={16} color={theme.accentBright} />
            </IconBadge>
            <Text style={[styles.rowLabel, { color: theme.text }]}>OCR language packs</Text>
            <Text style={[styles.rowValue, { color: theme.muted }]}>English</Text>
            <CaretRight size={13} color={theme.faint} />
          </Pressable>
        </Card>

        <SectionLabel>Appearance</SectionLabel>
        <Card style={styles.appearanceCard}>
          <View style={styles.tileRow}>
            {APPEARANCE_OPTIONS.map((o) => {
              const on = appearance === o.v;
              return (
                <Pressable
                  key={o.v}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.label} appearance`}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSetAppearance(o.v);
                  }}
                  style={styles.tile}
                >
                  <View
                    style={[
                      styles.tilePreview,
                      { backgroundColor: o.bg, borderColor: on ? theme.accent : theme.divider },
                    ]}
                  >
                    {o.split === true && (
                      <Svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 100 74"
                        preserveAspectRatio="none"
                        style={StyleSheet.absoluteFill}
                      >
                        <Polygon points="58,0 100,0 100,74 42,74" fill="#e4e7f5" />
                      </Svg>
                    )}
                    <View style={[styles.tileBar1, { backgroundColor: o.bar1 }]} />
                    <View style={[styles.tileBar2, { backgroundColor: o.bar2 }]} />
                    <View style={styles.tileAccentBar} />
                    {on && <CheckPop accent={theme.accent} />}
                  </View>
                  <Text style={[styles.tileLabel, { color: on ? theme.accentBright : theme.muted }]}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.appearanceFoot, { color: theme.faint }]}>
            System follows your iPhone's appearance.
          </Text>
        </Card>

        <SectionLabel>Privacy</SectionLabel>
        <Card style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="How on-device AI works"
            onPress={onOpenPrivacy}
            style={({ pressed }) => [
              styles.row,
              styles.rowDivided,
              { borderBottomColor: theme.divider },
              pressed && { backgroundColor: pressedBg },
            ]}
          >
            <IconBadge>
              <ShieldCheck size={16} color={theme.accentBright} />
            </IconBadge>
            <Text style={[styles.rowLabel, { color: theme.text }]}>How on-device AI works</Text>
            <CaretRight size={13} color={theme.faint} />
          </Pressable>
          <View style={styles.row}>
            <IconBadge>
              <CloudSlash size={16} color={theme.accentBright} />
            </IconBadge>
            <Text style={[styles.rowInfo, { color: theme.muted }]}>
              No account · no ads · nothing tracked about what you scan. Scans never leave this
              iPhone.
            </Text>
          </View>
        </Card>

        <SectionLabel>About</SectionLabel>
        <Card style={styles.aboutCard}>
          <View style={[styles.row, styles.rowDivided, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Version</Text>
            <Text style={[styles.rowValue, { color: theme.muted }]}>{appConfig.expo.version}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Engine</Text>
            <Text style={[styles.rowValue, { color: theme.muted }]}>
              ExecuTorch · CRAFT+CRNN · Qwen 3 0.6B
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingTop: 8, paddingHorizontal: 18, paddingBottom: 40 },
  groupCard: { marginBottom: 16, overflow: 'hidden' },
  aboutCard: { overflow: 'hidden' },
  modelsBlock: { paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  rowDivided: { borderBottomWidth: 1 },
  rowLabel: { flex: 1, fontSize: 14.5, fontFamily: font.regular },
  rowValue: { fontSize: 12.5, fontFamily: font.regular },
  rowInfo: { flex: 1, fontSize: 13, lineHeight: 19.5, fontFamily: font.regular },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  chipText: { fontSize: 10.5, fontFamily: font.regular },
  bar: { flexDirection: 'row', gap: 2 },
  storageCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  captionText: { fontSize: 10.5, fontFamily: font.regular },
  captionLeft: { flexShrink: 1 },
  appearanceCard: { marginBottom: 16, padding: 14 },
  tileRow: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, alignItems: 'center', gap: 7 },
  tilePreview: {
    width: '100%',
    height: 74,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  tileBar1: {
    position: 'absolute',
    top: 10,
    left: 9,
    right: 9,
    height: 8,
    borderRadius: 4,
  },
  tileBar2: {
    position: 'absolute',
    top: 24,
    left: 9,
    width: '58%',
    height: 6,
    borderRadius: 3,
  },
  tileAccentBar: {
    position: 'absolute',
    bottom: 9,
    left: 9,
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9184d9',
  },
  checkDisc: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { fontSize: 12, fontFamily: font.medium },
  appearanceFoot: {
    fontSize: 11.5,
    fontFamily: font.regular,
    marginTop: 10,
    textAlign: 'center',
  },
});
