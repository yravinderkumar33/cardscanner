import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, PermissionStatus, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { font } from '../theme/fonts';
import { TOP_INSET } from '../theme/layout';
import { useTheme } from '../theme/ThemeContext';
import { cameraChrome } from '../theme/tokens';
import { Btn } from './ui/Btn';
import {
  CameraSlash,
  CheckCircle,
  ClockCounterClockwise,
  GearSix,
  Images,
  Lightning,
  LightningSlash,
  WarningCircle,
  X,
} from './ui/icons';
import { useToast } from './ui/Toast';

type CamState = 'idle' | 'hint' | 'locked';

const GUIDE_W = 330;
const GUIDE_H = 210;

export function CaptureScreen({
  onImage,
  banner,
  onDismissBanner,
  onOpenHistory,
  onOpenSettings,
  showCoach,
  onCoachDone,
  covered = false,
  pendingScan = false,
}: {
  onImage(uri: string): void;
  banner: string | null;
  onDismissBanner(): void;
  onOpenHistory(): void;
  onOpenSettings(): void;
  showCoach: boolean;
  onCoachDone(): void;
  /** An overlay screen sits on top — pause the camera and ambient animations. */
  covered?: boolean;
  /** The last capture is queued behind a scan that is still settling. */
  pendingScan?: boolean;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [camState, setCamState] = useState<CamState>('idle');
  const [flashOn, setFlashOn] = useState(false);
  const busyRef = useRef(false);
  const [awaitingScan, setAwaitingScan] = useState(false);

  const granted = !!permission?.granted;
  const denied = permission?.status === PermissionStatus.DENIED;

  // `active` toggles the AVCaptureSession, but onCameraReady fires only once at
  // mount — it never re-fires when the session restarts, so `cameraReady` stays
  // stale-true across a pause. Hold the shutter until the restart has landed.
  const [resuming, setResuming] = useState(false);
  useEffect(() => {
    if (covered) {
      setResuming(true);
      return;
    }
    const t = setTimeout(() => setResuming(false), 600);
    return () => clearTimeout(t);
  }, [covered]);

  // The shell normally swaps to Processing (unmounting this screen). If the
  // swap is delayed, unlock after a beat so the shutter can never dead-end —
  // but not while the photo sits in the pipeline's single-slot queue, where a
  // second capture would silently replace it.
  useEffect(() => {
    if (!awaitingScan || pendingScan) return;
    const t = setTimeout(() => {
      setAwaitingScan(false);
      setCamState('idle');
    }, 1500);
    return () => clearTimeout(t);
  }, [awaitingScan, pendingScan]);

  // Animated values.
  const rootFade = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0.65)).current;
  const bracketPulse = useRef(new Animated.Value(1)).current;
  const flashFx = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const coachFade = useRef(new Animated.Value(0)).current;

  // kfFade entrance for the whole screen.
  useEffect(() => {
    Animated.timing(rootFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [rootFade]);

  // Ask for camera permission the first time (status undetermined).
  useEffect(() => {
    if (permission && permission.status === PermissionStatus.UNDETERMINED) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Status-pill dot: kfPulse 2.2s ease infinite (opacity 0.65 -> 1 -> 0.65).
  useEffect(() => {
    if (covered) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0.65,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dotPulse, covered]);

  // Idle -> hint after 2.4s (paused while the coach overlay is up).
  useEffect(() => {
    if (showCoach || covered || camState !== 'idle') return;
    const t = setTimeout(() => setCamState('hint'), 2400);
    return () => clearTimeout(t);
  }, [showCoach, covered, camState]);

  // Brackets pulse (kfPulse 1.1s) only in the hint state.
  useEffect(() => {
    if (covered || camState !== 'hint') {
      bracketPulse.setValue(1);
      return;
    }
    bracketPulse.setValue(0.65);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bracketPulse, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bracketPulse, {
          toValue: 0.65,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      bracketPulse.setValue(1);
    };
  }, [camState, covered, bracketPulse]);

  // kfIn for the error banner whenever a new one arrives.
  useEffect(() => {
    if (banner == null) return;
    bannerAnim.setValue(0);
    Animated.timing(bannerAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [banner, bannerAnim]);

  // kfFade for the coach overlay.
  useEffect(() => {
    if (!showCoach) {
      coachFade.setValue(0);
      return;
    }
    coachFade.setValue(0);
    Animated.timing(coachFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [showCoach, coachFade]);

  const takePhoto = async () => {
    if (denied) {
      toast('Camera is off — import from Photos instead.');
      return;
    }
    if (!granted || !cameraRef.current || !cameraReady) return;
    if (covered || resuming) return;
    if (busyRef.current || camState === 'locked') return;
    busyRef.current = true;
    setCamState('locked');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flashFx.setValue(0.9);
    Animated.timing(flashFx, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        onImage(photo.uri);
        setAwaitingScan(true);
        return;
      }
      setCamState('idle');
      toast('Could not take the photo — try again.');
    } catch (e) {
      console.warn('capture failed', e);
      setCamState('idle');
      toast('Could not take the photo — try again, or import from Photos.');
    } finally {
      busyRef.current = false;
    }
  };

  const pickFromGallery = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) onImage(uri);
      else toast('Could not open that photo — try a different one.');
    } catch (e) {
      console.warn('gallery import failed', e);
      toast('Could not import that photo — it may still be in iCloud.');
    } finally {
      busyRef.current = false;
    }
  };

  const locked = camState === 'locked';
  const guideColor = locked
    ? cameraChrome.accent
    : camState === 'hint'
      ? 'rgba(233,233,237,0.95)'
      : 'rgba(233,233,237,0.7)';
  const hintText = locked
    ? pendingScan
      ? 'Got it — finishing the last scan'
      : 'Got it'
    : camState === 'hint'
      ? 'Hold steady — capturing when sharp'
      : 'Line up the card in the frame';
  const hintColor = locked ? cameraChrome.accentBright : 'rgba(233,233,237,0.85)';

  return (
    <Animated.View style={[styles.root, { opacity: rootFade }]}>
      {granted && (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            active={!covered}
            facing="back"
            // Torch, not `flash`: `flash` only fires for the instant of capture,
            // so the toggle looked dead and could not light the card while you
            // frame it. The torch stays on through the shot, which also avoids
            // the specular glare a flash throws off a glossy card.
            enableTorch={flashOn && !covered}
            onCameraReady={() => setCameraReady(true)}
          />

          {/* Card guide corner brackets */}
          <Animated.View style={[styles.guide, { opacity: bracketPulse }]} pointerEvents="none">
            <View style={[styles.bracket, styles.bracketTL, { borderColor: guideColor }]} />
            <View style={[styles.bracket, styles.bracketTR, { borderColor: guideColor }]} />
            <View style={[styles.bracket, styles.bracketBL, { borderColor: guideColor }]} />
            <View style={[styles.bracket, styles.bracketBR, { borderColor: guideColor }]} />
          </Animated.View>

          {/* Hint pill under the guide */}
          <View style={styles.hintWrap} pointerEvents="none">
            <View style={styles.hintPill}>
              {locked && <CheckCircle size={15} color={hintColor} />}
              <Text style={[styles.hintText, { color: hintColor }]}>{hintText}</Text>
            </View>
          </View>
        </>
      )}

      {denied && (
        <View style={[styles.denied, { backgroundColor: theme.bg }]}>
          <View
            style={[
              styles.deniedTile,
              { backgroundColor: theme.accentTint, borderColor: theme.divider },
            ]}
          >
            <CameraSlash size={38} color={theme.muted} />
          </View>
          <Text style={[styles.deniedTitle, { color: theme.text }]}>Camera access is off</Text>
          <Text style={[styles.deniedBody, { color: theme.muted }]}>
            CardScanner uses the camera only to photograph cards — every photo is processed on this
            iPhone and never uploaded.
          </Text>
          {permission?.canAskAgain ? (
            <Btn
              label="Allow camera access"
              variant="primary"
              onPress={() => {
                requestPermission();
              }}
              style={styles.deniedBtn}
              textStyle={styles.deniedBtnText}
            />
          ) : (
            <Btn
              label="Open iOS Settings"
              variant="primary"
              onPress={() => {
                Linking.openSettings();
              }}
              style={styles.deniedBtn}
              textStyle={styles.deniedBtnText}
            />
          )}
          <Text style={[styles.deniedOr, { color: theme.faint }]}>— or —</Text>
          <Btn
            label="Import from Photos — still works"
            variant="secondary"
            icon={<Images size={16} color={theme.text} />}
            onPress={pickFromGallery}
            style={styles.deniedBtn}
            textStyle={styles.deniedBtnText}
          />
        </View>
      )}

      {/* Gradient scrims */}
      <Svg width="100%" height={130} style={styles.scrimTop} pointerEvents="none">
        <Defs>
          <LinearGradient id="capScrimTop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05060a" stopOpacity={0.65} />
            <Stop offset="1" stopColor="#05060a" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#capScrimTop)" />
      </Svg>
      <Svg width="100%" height={190} style={styles.scrimBottom} pointerEvents="none">
        <Defs>
          <LinearGradient id="capScrimBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05060a" stopOpacity={0} />
            <Stop offset="1" stopColor="#05060a" stopOpacity={0.78} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#capScrimBottom)" />
      </Svg>

      {/* Error banner */}
      {banner != null && (
        <Animated.View
          style={[
            styles.banner,
            {
              opacity: bannerAnim,
              transform: [
                { translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
              ],
            },
          ]}
        >
          <WarningCircle size={18} color={cameraChrome.warning} />
          <Text style={styles.bannerText}>{banner}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onDismissBanner}
            style={styles.bannerDismiss}
            hitSlop={8}
          >
            <X size={15} color={cameraChrome.muted} />
          </Pressable>
        </Animated.View>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={flashOn ? 'Turn the flashlight off' : 'Turn the flashlight on'}
          accessibilityState={{ selected: flashOn }}
          disabled={!granted}
          onPress={() => {
            Haptics.selectionAsync();
            setFlashOn((f) => !f);
          }}
          style={({ pressed }) => [styles.glassCircle, pressed && styles.glassPressed]}
        >
          {flashOn ? (
            <Lightning size={19} color={cameraChrome.accentBright} />
          ) : (
            <LightningSlash size={19} color={cameraChrome.text} />
          )}
        </Pressable>
        <Text style={styles.wordmark}>CARDSCANNER</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.glassCircle, pressed && styles.glassPressed]}
        >
          <GearSix size={19} color={cameraChrome.text} />
        </Pressable>
      </View>

      {/* On-device status pill */}
      <View style={styles.statusWrap} pointerEvents="none">
        <View style={styles.statusPill}>
          <Animated.View style={[styles.statusDot, { opacity: dotPulse }]} />
          <Text style={styles.statusText}>On-device AI · ready — no connection needed</Text>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import from Photos"
          onPress={pickFromGallery}
          style={({ pressed }) => [styles.galleryBtn, pressed && styles.pressedDim]}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="capGalleryG" x1="0" y1="0" x2="0.36" y2="1">
                <Stop offset="0" stopColor="#efeadf" />
                <Stop offset="1" stopColor="#d9d2c2" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#capGalleryG)" />
          </Svg>
          <View style={styles.galleryStripA} />
          <View style={styles.galleryStripB} />
          <View style={styles.galleryIcon}>
            <Images size={15} color="#22303c" weight="fill" />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          onPress={takePhoto}
          onPressIn={() =>
            Animated.timing(shutterScale, {
              toValue: 0.93,
              duration: 120,
              useNativeDriver: true,
            }).start()
          }
          onPressOut={() =>
            Animated.timing(shutterScale, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }).start()
          }
        >
          <Animated.View
            style={[
              styles.shutterRing,
              { transform: [{ scale: shutterScale }], opacity: denied || resuming ? 0.35 : 1 },
            ]}
          >
            <View style={styles.shutterFill} />
          </Animated.View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          onPress={onOpenHistory}
          style={({ pressed }) => [styles.glassCircleLg, pressed && styles.glassPressed]}
        >
          <ClockCounterClockwise size={21} color={cameraChrome.text} />
        </Pressable>
      </View>

      {/* White capture flash */}
      <Animated.View
        style={[styles.flashFx, { opacity: flashFx }]}
        pointerEvents="none"
      />

      {/* First-run coach overlay */}
      {showCoach && (
        <Animated.View style={[styles.coach, { opacity: coachFade }]}>
          <View style={styles.coachCenter}>
            <View style={styles.coachBubbleLg}>
              <Text style={styles.coachTextLg}>Tap to scan the card in the frame</Text>
            </View>
            <View style={[styles.coachStem, styles.coachStemLg]} />
            <View style={styles.coachDot} />
          </View>
          <View style={styles.coachLeft}>
            <View style={styles.coachBubble}>
              <Text style={styles.coachText}>Or import a card photo</Text>
            </View>
            <View style={styles.coachStem} />
            <View style={styles.coachDot} />
          </View>
          <View style={styles.coachRight}>
            <View style={styles.coachBubble}>
              <Text style={styles.coachText}>Every scan stays here, on the phone</Text>
            </View>
            <View style={styles.coachStem} />
            <View style={styles.coachDot} />
          </View>
          <View style={styles.coachDoneWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Got it"
              onPress={onCoachDone}
              style={({ pressed }) => [styles.coachDone, pressed && styles.pressedDim]}
            >
              <Text style={styles.coachDoneText}>Got it</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cameraChrome.bg },

  guide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: GUIDE_W,
    height: GUIDE_H,
    transform: [{ translateX: -GUIDE_W / 2 }, { translateY: -GUIDE_H * 0.52 }],
  },
  bracket: { position: 'absolute', width: 26, height: 26 },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 8,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 8,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 8,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 8,
  },

  hintWrap: { position: 'absolute', top: '50%', left: 0, right: 0, alignItems: 'center' },
  hintPill: {
    marginTop: 88, // prototype: translate(-50%, 88px) from the vertical center
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(12,13,20,0.62)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  hintText: { fontSize: 12.5, fontFamily: font.regular },

  denied: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 34,
    gap: 15,
  },
  deniedTile: {
    width: 84,
    height: 84,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedTitle: { fontSize: 21, fontFamily: font.medium, textAlign: 'center' },
  deniedBody: {
    fontSize: 13.5,
    fontFamily: font.regular,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
  deniedBtn: { width: '100%', maxWidth: 280, paddingVertical: 12 },
  deniedBtnText: { fontSize: 14 },
  deniedOr: { fontSize: 11.5, fontFamily: font.regular },

  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  banner: {
    position: 'absolute',
    top: 62,
    left: 14,
    right: 14,
    backgroundColor: 'rgba(28,25,20,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(223,169,107,0.5)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    zIndex: 6,
  },
  bannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: cameraChrome.text,
    fontFamily: font.regular,
  },
  bannerDismiss: { padding: 2 },

  topBar: {
    position: 'absolute',
    top: TOP_INSET,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    zIndex: 5,
  },
  glassCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: cameraChrome.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCircleLg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: cameraChrome.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassPressed: { backgroundColor: cameraChrome.glassStrong },
  wordmark: {
    fontSize: 11,
    letterSpacing: 2.42,
    color: cameraChrome.textDim,
    fontFamily: font.regular,
  },

  statusWrap: {
    position: 'absolute',
    top: 106,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22,24,38,0.45)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: cameraChrome.accent },
  statusText: {
    fontSize: 10.5,
    color: 'rgba(233,233,237,0.75)',
    fontFamily: font.regular,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    paddingBottom: 42,
    zIndex: 5,
  },
  galleryBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(233,233,237,0.28)',
    overflow: 'hidden',
  },
  galleryStripA: {
    position: 'absolute',
    top: 6,
    left: 5,
    right: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: '#22303c',
    opacity: 0.75,
  },
  galleryStripB: {
    position: 'absolute',
    top: 16,
    left: 5,
    right: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#5b6773',
    opacity: 0.6,
  },
  galleryIcon: { position: 'absolute', right: 4, bottom: 3, opacity: 0.85 },
  pressedDim: { opacity: 0.85 },

  shutterRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: cameraChrome.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterFill: { width: 56, height: 56, borderRadius: 28, backgroundColor: cameraChrome.text },

  flashFx: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 9 },

  coach: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,9,15,0.72)',
    zIndex: 8,
  },
  coachCenter: {
    position: 'absolute',
    bottom: 126,
    left: '50%',
    width: 200,
    marginLeft: -100,
    alignItems: 'center',
  },
  coachLeft: { position: 'absolute', bottom: 112, left: 16, width: 132, alignItems: 'center' },
  coachRight: { position: 'absolute', bottom: 112, right: 12, width: 140, alignItems: 'center' },
  coachBubbleLg: {
    backgroundColor: 'rgba(35,37,50,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(145,132,217,0.4)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  coachBubble: {
    backgroundColor: 'rgba(35,37,50,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(145,132,217,0.4)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  coachTextLg: {
    fontSize: 13,
    lineHeight: 20,
    color: cameraChrome.text,
    fontFamily: font.regular,
    textAlign: 'center',
  },
  coachText: {
    fontSize: 12,
    lineHeight: 17,
    color: cameraChrome.text,
    fontFamily: font.regular,
    textAlign: 'center',
  },
  coachStem: { width: 1, height: 16, backgroundColor: 'rgba(145,132,217,0.6)' },
  coachStemLg: { height: 22 },
  coachDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: cameraChrome.accent },
  coachDoneWrap: { position: 'absolute', top: 66, left: 0, right: 0, alignItems: 'center' },
  coachDone: {
    paddingVertical: 9,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: cameraChrome.accent,
    backgroundColor: 'rgba(22,24,38,0.6)',
  },
  coachDoneText: { fontSize: 13.5, color: cameraChrome.accentBright, fontFamily: font.medium },
});
