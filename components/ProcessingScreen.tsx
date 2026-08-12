import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { cameraChrome } from '../theme/tokens';
import { Check, Sparkle } from './ui/icons';
import { Sheet } from './ui/Sheet';

// Processing screen from the prototype (screen 03): the captured photo works
// in the open — an OCR scan sweep, then a live token stream with real OCR
// boxes lighting up on the card. Always-dark camera chrome.

export interface ProcessingDetection {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  text: string;
  score: number;
}

const CARD_W = 264;
const CARD_FALLBACK_H = 163;
const MAX_CARD_H = 300;
const SCAN_H = 26;
const DIM_BORDER = 'rgba(147,151,171,0.35)';

const FIELD_CHIPS: [string, string][] = [
  ['firstName', 'Name'],
  ['company', 'Company'],
  ['jobTitle', 'Title'],
  ['phones', 'Phones'],
  ['emails', 'Email'],
  ['address', 'Address'],
];

export function ProcessingScreen({
  stage,
  streamText,
  imageUri,
  imageSize,
  detections,
  llmStartedAt,
  getTokenCount,
  onCancel,
}: {
  stage: 'ocr' | 'llm';
  streamText: string;
  imageUri: string | null;
  imageSize: { width: number; height: number } | null;
  detections: ProcessingDetection[];
  llmStartedAt: number | null;
  /** Generated-token count from the LLM runtime; only settles once generation
   *  finishes, so the rate is estimated from the stream until then. */
  getTokenCount?: () => number;
  onCancel(): void;
}) {
  const { theme } = useTheme();
  const [cancelOpen, setCancelOpen] = useState(false);

  // ── Card geometry: contain-fit the photo at ~264pt wide ───────────────────
  const { cardW, cardH } = useMemo(() => {
    if (imageSize && imageSize.width > 0 && imageSize.height > 0) {
      const s = Math.min(CARD_W / imageSize.width, MAX_CARD_H / imageSize.height);
      return { cardW: Math.round(imageSize.width * s), cardH: Math.round(imageSize.height * s) };
    }
    return { cardW: CARD_W, cardH: CARD_FALLBACK_H };
  }, [imageSize]);

  // ── Entrance fade (kfFade 300ms) ──────────────────────────────────────────
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeIn]);

  // ── VoiceOver stage announcements (the design's aria-live) ────────────────
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      stage === 'ocr' ? 'Reading the card, a few seconds' : 'Extracting details, about 20 seconds'
    );
  }, [stage]);

  // ── OCR scan sweep (kfScan 1.5s ease-in-out infinite) ─────────────────────
  const scanY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== 'ocr') return;
    scanY.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, scanY]);
  const scanTranslate = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [4, Math.max(4, cardH - SCAN_H - 4)],
  });

  // ── LLM glow border pulse (kfGlow 2.4s ease infinite) ─────────────────────
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== 'llm') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, glow]);
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  // ── Stream panel entrance (kfIn) ──────────────────────────────────────────
  const llmIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== 'llm') return;
    Animated.timing(llmIn, { toValue: 1, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [stage, llmIn]);

  // ── Blinking cursor (kfBlink 0.9s step-end infinite) ──────────────────────
  const cursor = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (stage !== 'llm') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 0, duration: 1, delay: 450, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 1, duration: 1, delay: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, cursor]);

  // ── Live token rate: runtime count once it lands, else ~chars/4 ───────────
  const [tokRate, setTokRate] = useState<string | null>(null);
  const streamRef = useRef(streamText);
  streamRef.current = streamText;
  useEffect(() => {
    if (stage !== 'llm' || llmStartedAt == null) {
      setTokRate(null);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - llmStartedAt) / 1000;
      let tokens: number | null = null;
      try {
        // The runtime publishes num_generated_tokens only once generate()
        // returns (it is zeroed at the start of every generation), so this
        // reads 0 while streaming and the estimate below carries the readout.
        const real = getTokenCount?.();
        if (typeof real === 'number' && real > 0) tokens = real;
      } catch {
        // runtime not ready — fall back to the character estimate
      }
      if (tokens == null) tokens = streamRef.current.length / 4;
      // Hold the readout until there is a full second and real output to
      // divide, otherwise the first sample prints a meaningless number.
      if (elapsed <= 1 || tokens <= 0) {
        setTokRate(null);
        return;
      }
      setTokRate(`~${Math.round(tokens / elapsed)} tok/s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stage, llmStartedAt, getTokenCount]);

  // ── Auto-scroll the stream to the bottom until the user scrolls away ──────
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollRef = useRef(true);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    autoScrollRef.current = distFromBottom < 40;
  };
  const handleContentSize = () => {
    if (autoScrollRef.current) scrollRef.current?.scrollToEnd({ animated: false });
  };

  // ── Real OCR boxes, scaled from image space onto the card ─────────────────
  const topBoxes = useMemo(
    () => [...detections].sort((a, b) => b.score - a.score).slice(0, 6),
    [detections]
  );
  const boxStyles = useMemo<ViewStyle[]>(() => {
    if (!imageSize || imageSize.width <= 0 || imageSize.height <= 0) return [];
    const sx = cardW / imageSize.width;
    const sy = cardH / imageSize.height;
    return topBoxes.map((d, i) => {
      const left = Math.max(0, Math.min(cardW - 2, d.bbox.x1 * sx));
      const top = Math.max(0, Math.min(cardH - 2, d.bbox.y1 * sy));
      const width = Math.max(2, Math.min(cardW - left, (d.bbox.x2 - d.bbox.x1) * sx));
      const height = Math.max(2, Math.min(cardH - top, (d.bbox.y2 - d.bbox.y1) * sy));
      return {
        position: 'absolute' as const,
        left,
        top,
        width,
        height,
        borderWidth: 1,
        borderRadius: 3,
        borderColor: `rgba(145,132,217,${Math.max(0.55, 0.9 - i * 0.06).toFixed(2)})`,
      };
    });
  }, [topBoxes, imageSize, cardW, cardH]);

  const ocrActive = stage === 'ocr';
  const llmActive = stage === 'llm';

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      {/* Backdrop: the captured photo, blurred + dimmed */}
      {imageUri != null && (
        <Image source={{ uri: imageUri }} blurRadius={22} style={styles.backdrop} resizeMode="cover" />
      )}
      <View style={styles.overlay} />

      <View style={styles.content}>
        {/* The card: the photo again, sharp */}
        <View style={[styles.card, { width: cardW, height: cardH }]}>
          {imageUri != null ? (
            <Image source={{ uri: imageUri }} style={styles.cardImg} resizeMode="cover" />
          ) : (
            <View style={[styles.cardImg, { backgroundColor: cameraChrome.glassStrong }]} />
          )}
          {ocrActive && (
            <Animated.View
              pointerEvents="none"
              style={[styles.scanLine, { transform: [{ translateY: scanTranslate }] }]}
            >
              <Svg width="100%" height={SCAN_H}>
                <Defs>
                  <LinearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={cameraChrome.accent} stopOpacity={0} />
                    <Stop offset="0.5" stopColor={cameraChrome.accent} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={cameraChrome.accent} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width="100%" height={SCAN_H} fill="url(#scanGrad)" />
              </Svg>
            </Animated.View>
          )}
          {llmActive && (
            <Animated.View pointerEvents="none" style={[styles.glowBorder, { opacity: glowOpacity }]} />
          )}
          {llmActive && boxStyles.map((bs, i) => <OcrBox key={i} delay={i * 150} style={bs} />)}
        </View>

        {/* Stage chips */}
        <View style={styles.stepsRow}>
          <View style={[styles.pill, { borderColor: ocrActive ? cameraChrome.accent : DIM_BORDER }]}>
            {llmActive ? (
              <Check size={13} color={cameraChrome.muted} />
            ) : (
              <Spinner color={cameraChrome.accentBright} />
            )}
            <Text style={[styles.pillText, { color: ocrActive ? cameraChrome.accentBright : cameraChrome.muted }]}>
              Reading the card
            </Text>
          </View>
          <View style={styles.connector} />
          <View style={[styles.pill, { borderColor: llmActive ? cameraChrome.accent : DIM_BORDER }]}>
            {llmActive && <Spinner color={cameraChrome.accentBright} />}
            <Text style={[styles.pillText, { color: llmActive ? cameraChrome.accentBright : cameraChrome.muted }]}>
              Understanding the details
            </Text>
          </View>
        </View>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{ocrActive ? 'Reading the card…' : 'Understanding the details…'}</Text>
          <Text style={styles.sub}>
            {ocrActive
              ? 'On-device OCR — finding and reading the letters'
              : 'The language model fills the fields as it reads'}
          </Text>
        </View>

        {llmActive ? (
          <Animated.View
            style={[
              styles.llmArea,
              {
                opacity: llmIn,
                transform: [{ translateY: llmIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            {/* Live token stream panel */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Sparkle size={12} color={cameraChrome.accent} weight="fill" />
                <Text style={styles.panelHeaderText}>Qwen 3 · 0.6B · on this iPhone</Text>
                {tokRate != null && <Text style={styles.panelRate}>{tokRate}</Text>}
              </View>
              <ScrollView
                ref={scrollRef}
                style={styles.streamScroll}
                contentContainerStyle={styles.streamContent}
                onContentSizeChange={handleContentSize}
                onScroll={handleScroll}
                scrollEventThrottle={32}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.streamText}>
                  {streamText}
                  <Animated.View style={[styles.cursor, { opacity: cursor }]} />
                </Text>
              </ScrollView>
            </View>

            {/* Field chips light up as the stream mentions them */}
            <View style={styles.chipsRow}>
              {FIELD_CHIPS.map(([key, label]) => {
                const on = streamText.includes(key);
                return (
                  <View
                    key={key}
                    style={[
                      styles.fieldChip,
                      { borderColor: on ? cameraChrome.accent : 'rgba(147,151,171,0.3)' },
                    ]}
                  >
                    {on && <Check size={11} color={cameraChrome.accentBright} />}
                    <Text style={[styles.fieldChipText, { color: on ? cameraChrome.accentBright : '#75798c' }]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : (
          <View style={styles.spacer} />
        )}

        {/* Cancel */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel scan"
          onPress={() => setCancelOpen(true)}
          style={({ pressed }) => [styles.cancelBtn, pressed && { borderColor: 'rgba(233,233,237,0.6)' }]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Cancel confirm sheet */}
      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} floating>
        <View style={[styles.sheetCard, { backgroundColor: theme.surface }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.divider }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Stop scanning?</Text>
            <Text style={[styles.sheetBody, { color: theme.muted }]}>
              This scan stops now and nothing is kept.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setCancelOpen(false);
              onCancel();
            }}
            style={({ pressed }) => [
              styles.sheetAction,
              pressed && { backgroundColor: theme.dark ? 'rgba(224,138,132,0.08)' : 'rgba(180,82,77,0.08)' },
            ]}
          >
            <Text style={[styles.sheetActionText, { color: theme.danger }]}>Stop</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setCancelOpen(false)}
          style={({ pressed }) => [
            styles.sheetKeep,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accent,
              shadowOpacity: theme.shadowOpacity,
            },
            pressed && { backgroundColor: theme.accentTint },
          ]}
        >
          <Text style={[styles.sheetActionText, { color: theme.accentBright }]}>Keep scanning</Text>
        </Pressable>
      </Sheet>
    </Animated.View>
  );
}

// Rotating ring spinner used inside the active stage pill.
function Spinner({ color }: { color: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          borderColor: color,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        },
      ]}
    />
  );
}

// One OCR detection rect, fading in on a stagger.
function OcrBox({ delay, style }: { delay: number; style: ViewStyle }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(op, { toValue: 1, duration: 400, delay, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [delay, op]);
  return <Animated.View pointerEvents="none" style={[style, { opacity: op }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cameraChrome.bg, overflow: 'hidden' },
  backdrop: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    bottom: -30,
    transform: [{ scale: 1.1 }],
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,14,22,0.55)' },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 96,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 18,
  },
  card: {
    borderRadius: 7,
    backgroundColor: '#20222f',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
  cardImg: { ...StyleSheet.absoluteFillObject, borderRadius: 7 },
  scanLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 0,
    height: SCAN_H,
    borderRadius: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(145,132,217,0.9)',
    overflow: 'hidden',
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(145,132,217,0.85)',
    borderRadius: 7,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: cameraChrome.glass,
  },
  pillText: { fontSize: 12, fontFamily: font.regular },
  connector: { width: 14, height: 1, backgroundColor: 'rgba(147,151,171,0.5)' },
  spinner: {
    width: 11,
    height: 11,
    borderWidth: 1.5,
    borderRadius: 6,
    borderTopColor: 'transparent',
  },
  titleBlock: { alignItems: 'center', minHeight: 40 },
  title: { fontSize: 16.5, fontFamily: font.medium, color: cameraChrome.text },
  sub: { fontSize: 12, fontFamily: font.regular, color: cameraChrome.muted, marginTop: 3 },
  llmArea: { flex: 1, alignSelf: 'stretch', alignItems: 'center', gap: 18, minHeight: 0 },
  panel: {
    width: '100%',
    maxWidth: 330,
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(22,24,38,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(145,132,217,0.25)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  panelHeaderText: {
    fontSize: 10.5,
    fontFamily: font.regular,
    color: cameraChrome.muted,
    letterSpacing: 0.63,
    textTransform: 'uppercase',
  },
  panelRate: { marginLeft: 'auto', fontSize: 10.5, fontFamily: font.regular, color: '#75798c' },
  streamScroll: { flex: 1 },
  streamContent: { flexGrow: 1, justifyContent: 'flex-end' },
  streamText: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 18,
    color: cameraChrome.accentBright,
  },
  cursor: {
    width: 7,
    height: 13,
    backgroundColor: cameraChrome.accent,
    marginLeft: 2,
    transform: [{ translateY: 2 }],
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    justifyContent: 'center',
    maxWidth: 330,
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(22,24,38,0.5)',
  },
  fieldChipText: { fontSize: 10.5, fontFamily: font.regular },
  spacer: { flex: 1 },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,151,171,0.4)',
    backgroundColor: cameraChrome.glass,
  },
  cancelText: { fontSize: 13.5, fontFamily: font.medium, color: cameraChrome.text },
  sheetCard: { borderRadius: 16, overflow: 'hidden' },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 14.5, fontFamily: font.medium, marginBottom: 3, textAlign: 'center' },
  sheetBody: { fontSize: 12.5, fontFamily: font.regular, lineHeight: 19, textAlign: 'center' },
  sheetAction: { paddingVertical: 13, alignItems: 'center' },
  sheetActionText: { fontSize: 15, fontFamily: font.medium },
  sheetKeep: {
    marginTop: 8,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
});
