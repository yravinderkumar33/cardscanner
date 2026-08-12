import * as Haptics from 'expo-haptics';
import type { JSX, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  availableDiskBytes,
  formatBytes,
  llmSources,
  modelInstalled,
  ocrSources,
} from '../lib/modelManager';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { Btn } from './ui/Btn';
import { Card } from './ui/Card';
import { IconBadge } from './ui/IconBadge';
import {
  AirplaneTilt,
  ArrowClockwise,
  ArrowDown,
  Brain,
  Check,
  CheckCircle,
  Cloud,
  DownloadSimple,
  Scan,
  ShieldCheck,
  TextAa,
  Warning,
  WifiHigh,
  WifiSlash,
} from './ui/icons';
import { ProgressRing } from './ui/ProgressRing';
import { useToast } from './ui/Toast';

// First-launch onboarding: three value beats, then the honest model download.
// The shell owns the actual download; this screen renders its state.

const MB = 1024 * 1024;

// Fake business-card palette from the prototype (deliberately theme-independent).
const CARD_BG_TOP = '#f7f4ec';
const CARD_BG_BOTTOM = '#efeadf';
const CARD_INK = '#22303c';
const CARD_INK_SOFT = '#5b6773';
const CARD_INK_BODY = '#3c4854';

const BEATS = [
  {
    h: 'Point. Scan. Saved.',
    s: 'Paper cards become iPhone contacts in seconds.',
    b: 'Continue',
    f: '',
  },
  {
    h: 'Nothing leaves your phone.',
    s: 'The AI reads cards right here. Your contacts stay yours.',
    b: 'Continue',
    f: 'There is deliberately no login screen.',
  },
  {
    h: 'Works anywhere.',
    s: 'One-time setup, then fully offline — forever.',
    b: 'Set up the AI',
    f: 'One download, ~0.5 GB · then no connection needed',
  },
] as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// '#rrggbb' -> 'rgba(r,g,b,a)' — ports the prototype's color-mix() accents.
function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function OnboardingScreen({
  mode,
  setupState,
  ocrProgress,
  llmProgress,
  ocrTotalBytes,
  llmTotalBytes,
  downloadMbps,
  etaMinutes,
  onStartScanning,
  onRetryDownload,
  alreadyInstalled = false,
}: {
  mode: 'first-run' | 'redownload';
  setupState: 'run' | 'fail' | 'off' | 'sto' | 'rdy';
  ocrProgress: number;
  llmProgress: number;
  ocrTotalBytes: number;
  llmTotalBytes: number;
  downloadMbps: number;
  etaMinutes: number | null;
  onStartScanning(): void;
  onRetryDownload(): void;
  /** Models are on disk — setup is just loading them into memory, not downloading. */
  alreadyInstalled?: boolean;
}): JSX.Element {
  const { theme } = useTheme();
  const toast = useToast();
  const [view, setView] = useState<'beats' | 'download'>(mode === 'first-run' ? 'beats' : 'download');
  const [beat, setBeat] = useState<0 | 1 | 2>(0);

  // A model already on disk is never re-fetched, so its progress stays at 0 for
  // the whole session — sample the disk once and treat it as complete instead.
  const [installedAtMount] = useState(() => ({
    ocr: modelInstalled(ocrSources()),
    llm: modelInstalled(llmSources()),
  }));
  const ocr = installedAtMount.ocr ? 1 : clamp01(ocrProgress);
  const llm = installedAtMount.llm ? 1 : clamp01(llmProgress);
  const totalBytes = ocrTotalBytes + llmTotalBytes;
  const overall = totalBytes > 0 ? (ocrTotalBytes * ocr + llmTotalBytes * llm) / totalBytes : 0;
  const overallPct = Math.round(overall * 100);
  const ocrMb = Math.round((ocr * ocrTotalBytes) / MB);
  const llmMb = Math.round((llm * llmTotalBytes) / MB);
  // A retry restarts every unfinished download from byte 0, so the install
  // needs the full size of each model not yet on disk, plus unpacking slack.
  const remainingBytes = (ocr >= 1 ? 0 : ocrTotalBytes) + (llm >= 1 ? 0 : llmTotalBytes);
  const neededBytes = Math.round(remainingBytes * 1.8);
  // Freeing space means leaving the app, so re-read on every foreground while
  // the card is up — otherwise it keeps quoting the space they started with.
  const [freeTick, setFreeTick] = useState(0);
  useEffect(() => {
    if (setupState !== 'sto') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setFreeTick((n) => n + 1);
    });
    return () => sub.remove();
  }, [setupState]);
  const freeBytes = useMemo(
    () => (setupState === 'sto' ? availableDiskBytes() : 0),
    [setupState, freeTick]
  );

  // VoiceOver: announce every 10% while the download runs (design note).
  // Silent behind the beats — announcements interrupt whatever is being read.
  const announcedDecile = useRef(-1);
  useEffect(() => {
    if (view !== 'download' || setupState !== 'run') return;
    const decile = Math.floor(overallPct / 10) * 10;
    if (decile > 0 && decile !== announcedDecile.current) {
      announcedDecile.current = decile;
      AccessibilityInfo.announceForAccessibility(`AI setup ${decile} percent downloaded`);
    }
  }, [overallPct, setupState, view]);

  // Success haptic the moment both models land, plus VoiceOver announcements
  // for every state transition (deciles above only cover the 'run' state).
  const prevState = useRef(setupState);
  const announcedState = useRef<typeof setupState | null>(null);
  useEffect(() => {
    if (setupState !== prevState.current) {
      prevState.current = setupState;
      if (setupState === 'rdy') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
    // Behind the beats we stay silent and announce the state once the user
    // arrives, so nothing cuts into the intro being read out.
    if (view !== 'download' || announcedState.current === setupState) return;
    announcedState.current = setupState;
    const announcement =
      setupState === 'fail'
        ? 'Paused — connection dropped. Nothing lost.'
        : setupState === 'off'
          ? 'Waiting for a connection'
          : setupState === 'sto'
            ? 'Paused — not enough free space'
            : setupState === 'rdy'
              ? 'Ready to scan'
              : null;
    if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
  }, [setupState, view]);

  // ---- per-model status lines (ported from the prototype) ----
  const ocrStat =
    ocr >= 1
      ? 'Downloaded ✓'
      : setupState === 'run'
        ? `${ocrMb} of ${formatBytes(ocrTotalBytes)}`
        : setupState === 'fail'
          ? ocrMb > 0
            ? `Paused at ${ocrMb} MB — kept`
            : 'Waiting…'
          : 'Waiting…';
  const llmStat =
    llm >= 1
      ? 'Downloaded ✓'
      : setupState === 'run'
        ? llm > 0
          ? `${llmMb} of ${formatBytes(llmTotalBytes)}`
          : 'Queued — starts next'
        : setupState === 'fail'
          ? llmMb > 0
            ? `Paused at ${llmMb} MB — kept`
            : 'Waiting…'
          : setupState === 'sto'
            ? 'Paused — needs space'
            : 'Waiting for connection…';

  // ---- hero status line under the ring ----
  const hero = (() => {
    if (setupState === 'fail')
      return { text: 'Paused — connection dropped. Nothing lost.', Icon: WifiSlash, color: theme.danger };
    if (setupState === 'off')
      return { text: 'Waiting for a connection…', Icon: WifiSlash, color: theme.warning };
    if (setupState === 'sto')
      return { text: `Paused — needs ${formatBytes(neededBytes)} free`, Icon: Warning, color: theme.warning };
    if (overall <= 0)
      return { text: "Starting with the reader — it's quick", Icon: WifiHigh, color: theme.accentBright };
    const speed = `Wi-Fi ${downloadMbps.toFixed(1)} MB/s`;
    return {
      text: etaMinutes != null ? `About ${Math.max(1, Math.round(etaMinutes))} min left · ${speed}` : speed,
      Icon: WifiHigh,
      color: theme.accentBright,
    };
  })();

  const bt = BEATS[beat];

  const beatsView = (
    <FadeIn style={styles.beatsWrap}>
      <Wordmark
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            hitSlop={8}
            onPress={() => setView('download')}
            style={styles.skip}
          >
            {({ pressed }) => (
              <Text style={{ fontSize: 13, fontFamily: font.medium, color: pressed ? theme.text : theme.muted }}>
                Skip
              </Text>
            )}
          </Pressable>
        }
      />
      <View style={styles.beatBody}>
        <View style={styles.illustration}>
          <PopIn key={beat}>
            {beat === 0 ? <BeatCardToContact /> : beat === 1 ? <BeatPrivacy /> : <BeatOffline />}
          </PopIn>
        </View>
        <View style={styles.beatTextWrap}>
          <Text style={[styles.beatH, { color: theme.text }]}>{bt.h}</Text>
          <Text style={[styles.beatSub, { color: theme.muted }]}>{bt.s}</Text>
        </View>
      </View>
      <View style={styles.dots}>
        {([0, 1, 2] as const).map((i) => (
          <View
            key={i}
            style={{
              width: beat === i ? 22 : 8,
              height: 5,
              borderRadius: 3,
              backgroundColor: beat === i ? theme.accent : theme.divider,
            }}
          />
        ))}
      </View>
      <Btn
        label={bt.b}
        onPress={() => (beat < 2 ? setBeat((beat + 1) as 0 | 1 | 2) : setView('download'))}
      />
      <Text style={[styles.beatFoot, { color: theme.faint }]}>{bt.f}</Text>
    </FadeIn>
  );

  const readyBlock = (
    <View style={styles.readyWrap}>
      <PopIn>
        <GlowCheckTile />
      </PopIn>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.readyH, { color: theme.text }]}>Ready to scan</Text>
        <Text style={[styles.readySub, { color: theme.muted }]}>
          Both models live on your iPhone now. Wi-Fi is optional from here — airplane mode works too.
        </Text>
      </View>
      <Btn
        label="Start scanning"
        onPress={onStartScanning}
        style={{ alignSelf: 'stretch', maxWidth: 300, marginHorizontal: 'auto', width: '100%' }}
      />
    </View>
  );

  const busyBlock = (
    <FadeIn>
      <Text style={[styles.dlH, { color: theme.text }]}>Setting up the AI</Text>
      <Text style={[styles.dlSub, { color: theme.muted }]}>
        One download — then everything runs on this iPhone, forever.
      </Text>

      <View style={styles.ringWrap}>
        <ProgressRing size={164} strokeWidth={7} progress={overall}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.ringPct, { color: theme.text }]}>{overallPct}%</Text>
            <Text style={[styles.ringOf, { color: theme.muted }]}>of {formatBytes(totalBytes)}</Text>
          </View>
        </ProgressRing>
        <View style={styles.heroLine}>
          <hero.Icon size={14} color={hero.color} />
          <Text style={{ fontSize: 12, fontFamily: font.regular, color: theme.muted }}>{hero.text}</Text>
        </View>
      </View>

      <Card>
        <ModelRow
          Icon={TextAa}
          name="Text reader"
          sizeLabel={formatBytes(ocrTotalBytes)}
          desc="Finds and reads the letters"
          stat={ocrStat}
          statDone={ocr >= 1}
          progress={ocr}
          divider
        />
        <ModelRow
          Icon={Brain}
          name="Language model"
          sizeLabel={formatBytes(llmTotalBytes)}
          desc="Understands the text, fills the fields"
          stat={llmStat}
          statDone={llm >= 1}
          progress={llm}
        />
      </Card>

      <View style={styles.chipsRow}>
        <InfoChip Icon={DownloadSimple} label="One-time" />
        <InfoChip Icon={ArrowClockwise} label="Resumable — safe to leave" />
        <InfoChip Icon={WifiHigh} label="Wi-Fi best" />
      </View>

      {setupState === 'fail' && (
        <FadeIn
          style={[
            styles.stateCard,
            { backgroundColor: theme.surface, borderWidth: 1, borderColor: hexA(theme.danger, 0.45) },
          ]}
        >
          <View style={styles.stateRow}>
            <View style={styles.stateIcon}>
              <WifiSlash size={19} color={theme.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stateTitle, { color: theme.text }]}>Connection dropped</Text>
              <Text style={[styles.stateBody, { color: theme.muted }]}>
                Nothing is lost — the download resumes from where it stopped.
              </Text>
            </View>
          </View>
          <Btn label="Resume download" size="md" onPress={onRetryDownload} style={styles.stateBtn} />
        </FadeIn>
      )}

      {setupState === 'off' && (
        <FadeIn style={[styles.stateCard, { backgroundColor: theme.surface }]}>
          <View style={styles.stateRow}>
            <View style={styles.stateIcon}>
              <WifiSlash size={19} color={theme.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stateTitle, { color: theme.text }]}>You're offline right now</Text>
              <Text style={[styles.stateBody, { color: theme.muted }]}>
                Setup starts on its own the moment a connection comes back. Nothing else to do…
              </Text>
            </View>
          </View>
          <Btn
            label="I'll come back later"
            variant="secondary"
            size="md"
            onPress={() => toast("We'll be here — setup resumes on its own.")}
            style={styles.stateBtn}
          />
        </FadeIn>
      )}

      {setupState === 'sto' && (
        <FadeIn
          style={[
            styles.stateCard,
            { backgroundColor: theme.surface, borderWidth: 1, borderColor: hexA(theme.warning, 0.45) },
          ]}
        >
          <View style={styles.stateRow}>
            <View style={styles.stateIcon}>
              <Warning size={19} color={theme.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stateTitle, { color: theme.text }]}>Not enough free space</Text>
              <Text style={[styles.stateBody, { color: theme.muted }]}>
                Setup needs {formatBytes(neededBytes)} free while installing ({formatBytes(totalBytes)} after).
                This iPhone has {formatBytes(freeBytes)} free — clear some space and we'll pick up
                automatically.
              </Text>
            </View>
          </View>
          <Btn
            label="Check iPhone storage"
            size="md"
            onPress={() => {
              Linking.openSettings().catch(() => {});
            }}
            style={styles.stateBtn}
          />
        </FadeIn>
      )}
    </FadeIn>
  );

  // Models already on disk: the only wait is loading them into memory, so the
  // download UI (ring, MB counters) would be misleading — show a quiet warm-up.
  const warmingBlock = (
    <FadeIn style={styles.warmingWrap}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.warmingH, { color: theme.text }]}>Waking the on-device AI…</Text>
      <Text style={[styles.warmingSub, { color: theme.muted }]}>
        Both models are installed — loading them into memory takes a moment.
      </Text>
    </FadeIn>
  );

  const downloadView = (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.dlContent}
      showsVerticalScrollIndicator={false}
    >
      {mode === 'first-run' && <Wordmark style={{ marginBottom: 22 }} />}
      {setupState === 'rdy'
        ? readyBlock
        : alreadyInstalled && (setupState === 'run' || setupState === 'off')
          ? warmingBlock
          : busyBlock}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <TopWash />
      {view === 'beats' ? beatsView : downloadView}
    </View>
  );
}

// ---------------------------------------------------------------- chrome

// The prototype's radial accent wash bleeding down from the top edge.
function TopWash() {
  const { theme } = useTheme();
  return (
    <Svg pointerEvents="none" style={styles.wash} width="100%" height="100%">
      <Defs>
        <SvgRadialGradient id="onb-wash" cx="50%" cy="0%" rx="62%" ry="100%">
          <Stop offset="0%" stopColor="#423a6a" stopOpacity={theme.dark ? 0.5 : 0.18} />
          <Stop offset="100%" stopColor="#423a6a" stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#onb-wash)" />
    </Svg>
  );
}

function Wordmark({ trailing, style }: { trailing?: ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wordmark, style]}>
      <View style={[styles.wordmarkBadge, { borderColor: theme.accent }]}>
        <Scan size={17} color={theme.accent} />
      </View>
      <Text style={[styles.wordmarkName, { color: theme.text }]}>CardScanner</Text>
      {trailing}
    </View>
  );
}

// ---------------------------------------------------------------- animation helpers

// kfIn: fade + translateY 10 -> 0.
function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: ViewStyle | (ViewStyle | undefined | false)[];
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 350,
      delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// kfPop: scale 0.7 -> 1.06 -> 1 with fade.
function PopIn({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.7, 1.06, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- beat illustrations

// Vertical beige gradient fill for the fake business cards.
function BeigeFill({ id, radius }: { id: string; radius: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <SvgLinearGradient id={id} x1="0%" y1="0%" x2="21%" y2="100%">
          <Stop offset="0%" stopColor={CARD_BG_TOP} />
          <Stop offset="100%" stopColor={CARD_BG_BOTTOM} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

// Four accent scan-frame corners around the parent's bounds.
function Brackets({ size, color }: { size: number; color: string }) {
  const t = 2.5;
  const r = 7;
  return (
    <>
      <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderTopWidth: t, borderLeftWidth: t, borderColor: color, borderTopLeftRadius: r }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: size, height: size, borderTopWidth: t, borderRightWidth: t, borderColor: color, borderTopRightRadius: r }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: size, height: size, borderBottomWidth: t, borderLeftWidth: t, borderColor: color, borderBottomLeftRadius: r }} />
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: size, height: size, borderBottomWidth: t, borderRightWidth: t, borderColor: color, borderBottomRightRadius: r }} />
    </>
  );
}

// Beat 0 — a framed card turning into a saved contact chip.
function BeatCardToContact() {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={{ width: 196, height: 122 }}>
        <View style={[styles.beigeCard, { top: 10, bottom: 10, left: 8, right: 8, borderRadius: 7 }]}>
          <BeigeFill id="onb-beige-b0" radius={7} />
          <View style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 14 }}>
            <View style={styles.monogram}>
              <Text style={styles.monogramT}>M</Text>
            </View>
            <Text style={styles.fakeName}>Priya Raghunathan</Text>
            <Text style={styles.fakeTitle}>Director of Partnerships</Text>
            <Text style={styles.fakeLines}>+1 (415) 555-0198{'\n'}priya@example.com</Text>
          </View>
        </View>
        <Brackets size={20} color={theme.accent} />
      </View>
      <ArrowDown size={16} color={theme.accent} />
      <FadeIn delay={250}>
        <View style={[styles.contactChip, { backgroundColor: theme.surface, borderColor: theme.ring }]}>
          <View style={[styles.avatar, { backgroundColor: theme.accentTintStrong }]}>
            <Text style={{ fontSize: 12, fontFamily: font.medium, color: theme.accentBright }}>PR</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontFamily: font.medium, color: theme.text, lineHeight: 16 }}>
              Priya Raghunathan
            </Text>
            <Text style={{ fontSize: 11, fontFamily: font.regular, color: theme.muted }}>+1 (415) 555-0198</Text>
          </View>
          <View style={{ marginLeft: 4 }}>
            <CheckCircle size={17} color={theme.accentBright} />
          </View>
        </View>
      </FadeIn>
    </View>
  );
}

// Beat 1 — phone with shield, crossed-out cloud, "No account/sign-up/upsell".
function BeatPrivacy() {
  const { theme } = useTheme();
  const pill = {
    borderColor: hexA(theme.accent, 0.3),
    backgroundColor: hexA(theme.accent, 0.1),
  };
  return (
    <View style={{ alignItems: 'center', gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
        <View
          style={[
            styles.phoneOutline,
            { borderColor: hexA(theme.accent, 0.55), backgroundColor: hexA(theme.accent, 0.06) },
          ]}
        >
          <View style={[styles.phoneSpeaker, { backgroundColor: hexA(theme.accent, 0.35) }]} />
          <ShieldCheck size={34} color={theme.accentBright} weight="fill" />
          <View style={[styles.miniCard]}>
            <BeigeFill id="onb-beige-b1" radius={4} />
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Cloud size={38} color={theme.muted} />
            <View
              style={{
                position: 'absolute',
                width: 46,
                height: 2,
                borderRadius: 1,
                backgroundColor: theme.danger,
                transform: [{ rotate: '-38deg' }],
              }}
            />
          </View>
          <Text style={[styles.noCloud, { color: theme.muted }]}>no cloud</Text>
        </View>
      </View>
      <FadeIn delay={250} style={styles.pillRow}>
        <Text style={[styles.pillAccent, pill, { color: theme.accentBright }]}>No account</Text>
        <Text style={[styles.pillAccent, pill, { color: theme.accentBright }]}>No sign-up</Text>
        <Text style={[styles.pillAccent, pill, { color: theme.accentBright }]}>No upsell</Text>
      </FadeIn>
    </View>
  );
}

// Beat 2 — airplane-mode pill above a captured card with a check.
function BeatOffline() {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 16 }}>
      <View style={[styles.airplanePill, { backgroundColor: theme.surface, borderColor: theme.ring }]}>
        <AirplaneTilt size={18} color={theme.warning} weight="fill" />
        <Text style={{ fontSize: 13, fontFamily: font.medium, color: theme.text }}>Airplane mode</Text>
        <View style={[styles.toggle, { backgroundColor: hexA(theme.accent, 0.7) }]}>
          <View style={styles.toggleKnob} />
        </View>
      </View>
      <FadeIn delay={200}>
        <View style={{ width: 180, height: 112 }}>
          <View style={[styles.beigeCard, { top: 9, bottom: 9, left: 8, right: 8, borderRadius: 7 }]}>
            <BeigeFill id="onb-beige-b2" radius={7} />
          </View>
          <Brackets size={18} color={theme.accent} />
          <View style={styles.checkDiscWrap} pointerEvents="none">
            <View style={[styles.checkDisc, { backgroundColor: hexA(theme.accent, 0.88) }]}>
              <Check size={19} color="#161826" weight="bold" />
            </View>
          </View>
        </View>
      </FadeIn>
      <FadeIn delay={350} style={styles.pillRow}>
        <Text style={[styles.pillMuted, { color: theme.muted, borderColor: theme.divider }]}>A flight</Text>
        <Text style={[styles.pillMuted, { color: theme.muted, borderColor: theme.divider }]}>A basement</Text>
        <Text style={[styles.pillMuted, { color: theme.muted, borderColor: theme.divider }]}>
          A dead-signal hall
        </Text>
      </FadeIn>
    </View>
  );
}

// ---------------------------------------------------------------- download pieces

function ModelRow({
  Icon,
  name,
  sizeLabel,
  desc,
  stat,
  statDone,
  progress,
  divider,
}: {
  Icon: typeof TextAa;
  name: string;
  sizeLabel: string;
  desc: string;
  stat: string;
  statDone: boolean;
  progress: number;
  divider?: boolean;
}) {
  const { theme } = useTheme();
  const pct = Math.round(clamp01(progress) * 100);
  return (
    <View
      style={[
        styles.modelRow,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}
      accessible
      accessibilityLabel={`${name}, ${stat}`}
    >
      <View style={styles.modelRowTop}>
        <IconBadge size={32} radius={9}>
          <Icon size={17} color={theme.accentBright} />
        </IconBadge>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13.5, fontFamily: font.medium, color: theme.text }}>
            {name} <Text style={{ fontFamily: font.regular, color: theme.faint }}>· {sizeLabel}</Text>
          </Text>
          <Text style={{ fontSize: 11, fontFamily: font.regular, color: theme.muted }}>{desc}</Text>
        </View>
        <Text
          numberOfLines={1}
          style={{ fontSize: 11.5, fontFamily: font.regular, color: statDone ? theme.accent : theme.muted }}
        >
          {stat}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: hexA(theme.text, 0.09) }]}>
        <View
          style={{
            height: '100%',
            width: `${pct}%` as `${number}%`,
            backgroundColor: theme.accent,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}

function InfoChip({ Icon, label }: { Icon: typeof WifiHigh; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.infoChip, { borderColor: theme.divider }]}>
      <Icon size={11} color={theme.muted} />
      <Text style={{ fontSize: 11, fontFamily: font.regular, color: theme.muted }}>{label}</Text>
    </View>
  );
}

// Glowing check tile for the ready state (kfPop + kfGlow).
function GlowCheckTile() {
  const { theme } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -7,
          left: -7,
          right: -7,
          bottom: -7,
          borderRadius: 36,
          borderWidth: 1.5,
          borderColor: theme.accent,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.55] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        }}
      />
      <View
        style={[
          styles.readyTile,
          { backgroundColor: theme.accentTint, borderColor: theme.accentBorder },
        ]}
      >
        <Check size={44} color={theme.accentBright} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- styles

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },

  // wordmark header
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmarkBadge: {
    width: 30,
    height: 30,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkName: { fontFamily: font.medium, fontSize: 17, letterSpacing: -0.17 },
  skip: { marginLeft: 'auto', paddingVertical: 4, paddingHorizontal: 2 },

  // beats
  beatsWrap: { flex: 1, paddingTop: 74, paddingHorizontal: 28, paddingBottom: 30 },
  beatBody: { flex: 1, justifyContent: 'center', gap: 26, paddingBottom: 20 },
  illustration: { height: 196, alignItems: 'center', justifyContent: 'center' },
  beatTextWrap: { alignItems: 'center' },
  beatH: {
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: -0.58,
    fontFamily: font.medium,
    textAlign: 'center',
    marginBottom: 8,
  },
  beatSub: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: font.regular,
    textAlign: 'center',
    maxWidth: 280,
  },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center', marginBottom: 18 },
  beatFoot: {
    fontSize: 11.5,
    fontFamily: font.regular,
    textAlign: 'center',
    marginTop: 11,
    minHeight: 16,
  },

  // fake beige card
  beigeCard: {
    position: 'absolute',
    backgroundColor: CARD_BG_BOTTOM,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  monogram: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 17,
    height: 17,
    borderWidth: 1.6,
    borderColor: CARD_INK,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramT: { fontFamily: 'Georgia', fontWeight: '700', fontSize: 9, color: CARD_INK },
  fakeName: { fontFamily: 'Georgia', fontWeight: '700', fontSize: 11.5, color: CARD_INK },
  fakeTitle: {
    fontSize: 6.5,
    color: CARD_INK_SOFT,
    marginTop: 2,
    letterSpacing: 0.585,
    textTransform: 'uppercase',
  },
  fakeLines: { fontSize: 7, marginTop: 12, lineHeight: 12, color: CARD_INK_BODY },

  // beat 0 contact chip
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // beat 1
  phoneOutline: {
    width: 92,
    height: 158,
    borderWidth: 2,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  phoneSpeaker: {
    position: 'absolute',
    top: 7,
    alignSelf: 'center',
    width: 26,
    height: 7,
    borderRadius: 4,
  },
  miniCard: {
    width: 44,
    height: 28,
    borderRadius: 4,
    backgroundColor: CARD_BG_BOTTOM,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  noCloud: { fontSize: 10, fontFamily: font.regular, letterSpacing: 0.6, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', gap: 7 },
  pillAccent: {
    fontSize: 11.5,
    fontFamily: font.regular,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },
  pillMuted: {
    fontSize: 11.5,
    fontFamily: font.regular,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 11,
    overflow: 'hidden',
  },

  // beat 2
  airplanePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  toggle: { width: 38, height: 22, borderRadius: 12 },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#f3f5fe',
  },
  checkDiscWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDisc: {
    width: 34,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  // download view
  dlContent: { flexGrow: 1, paddingTop: 74, paddingHorizontal: 24, paddingBottom: 30 },
  warmingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 40 },
  warmingH: { fontSize: 21, fontFamily: font.medium, letterSpacing: -0.3, marginTop: 6 },
  warmingSub: { fontSize: 13.5, fontFamily: font.regular, lineHeight: 21, textAlign: 'center', maxWidth: 280 },
  dlH: { fontSize: 25, fontFamily: font.medium, letterSpacing: -0.5, marginBottom: 2 },
  dlSub: { fontSize: 13, fontFamily: font.regular, lineHeight: 19.5, marginBottom: 10 },
  ringWrap: { alignItems: 'center', gap: 4, marginBottom: 16 },
  ringPct: { fontSize: 33, fontFamily: font.medium, letterSpacing: -0.66, lineHeight: 35 },
  ringOf: { fontSize: 11, fontFamily: font.regular, marginTop: 4 },
  heroLine: { minHeight: 17, flexDirection: 'row', alignItems: 'center', gap: 6 },

  modelRow: { paddingVertical: 12, paddingHorizontal: 14 },
  modelRowTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  barTrack: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 9 },

  chipsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  // state cards
  stateCard: { marginTop: 14, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15 },
  stateRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stateIcon: { marginTop: 1 },
  stateTitle: { fontSize: 13.5, fontFamily: font.medium, marginBottom: 2 },
  stateBody: { fontSize: 12, fontFamily: font.regular, lineHeight: 18 },
  stateBtn: { marginTop: 11 },

  // ready state
  readyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  readyTile: {
    width: 96,
    height: 96,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyH: {
    fontSize: 27,
    fontFamily: font.medium,
    letterSpacing: -0.54,
    textAlign: 'center',
    marginBottom: 8,
  },
  readySub: {
    fontSize: 14,
    fontFamily: font.regular,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
});
