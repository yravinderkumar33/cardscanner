import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { saveToContacts } from '../lib/contacts';
import { availableDiskBytes, llmSources, modelInstalled, ocrSources } from '../lib/modelManager';
import { ContactFields } from '../lib/schema';
import { loadSettings, saveSettings } from '../lib/settingsStore';
import { useTheme } from '../theme/ThemeContext';
import { useScannerPipeline } from '../hooks/useScannerPipeline';
import { useToast } from './ui/Toast';
import { CaptureScreen } from './CaptureScreen';
import { DetailScreen } from './DetailScreen';
import { HistoryScreen } from './HistoryScreen';
import { ModelsScreen } from './ModelsScreen';
import { OnboardingScreen } from './OnboardingScreen';
import { PrivacyScreen } from './PrivacyScreen';
import { ProcessingScreen } from './ProcessingScreen';
import { ReviewScreen } from './ReviewScreen';
import { SettingsScreen } from './SettingsScreen';
import { SuccessScreen } from './SuccessScreen';

type Overlay =
  | { kind: 'history' }
  | { kind: 'detail'; id: string }
  | { kind: 'settings' }
  | { kind: 'models' }
  | { kind: 'privacy' };

export function AppShell({ onRetryModels }: { onRetryModels(): void }) {
  const pipeline = useScannerPipeline();
  const { theme, appearance, setAppearance } = useTheme();
  const toast = useToast();

  const [onboarded, setOnboarded] = useState(() => loadSettings().onboarded);
  // Sampled once per shell mount: with models on disk, "setup" is a brief
  // load-into-memory, not a download — the onboarding screen renders it so.
  const [modelsOnDisk] = useState(
    () => modelInstalled(ocrSources()) && modelInstalled(llmSources())
  );
  const [coachSeen, setCoachSeen] = useState(() => loadSettings().coachSeen);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [saving, setSaving] = useState(false);
  const retryArmedRef = useRef(false);

  const push = (o: Overlay) => setOverlays((s) => [...s, o]);
  const pop = () => setOverlays((s) => s.slice(0, -1));
  const closeOverlays = () => setOverlays([]);
  // "Scan a card" from an overlay must land on the camera, but the base phase
  // can advance underneath a mounted overlay (a queued capture starts its scan
  // when the previous one settles), so abandon that scan before revealing it.
  const startNewScan = () => {
    pipeline.cancel();
    pipeline.reset();
    closeOverlays();
  };

  // Returning users skip the onboarding "Ready" stop once models are live.
  useEffect(() => {
    if (pipeline.phase === 'setup' && pipeline.setupState === 'rdy' && onboarded) {
      pipeline.beginCapture();
    }
  }, [pipeline.phase, pipeline.setupState, onboarded, pipeline.beginCapture]);

  // "Setup starts on its own the moment a connection comes back": while the
  // download is failed/offline, one reconnect triggers a retry (remount).
  useEffect(() => {
    if (pipeline.phase !== 'setup') return;
    const stalled = pipeline.setupState === 'off' || pipeline.setupState === 'fail';
    if (stalled && !pipeline.online) retryArmedRef.current = true;
    if (stalled && pipeline.online && retryArmedRef.current) {
      retryArmedRef.current = false;
      onRetryModels();
    }
  }, [pipeline.phase, pipeline.setupState, pipeline.online, onRetryModels]);

  // "Clear some space and we'll pick up automatically": freeing storage means
  // leaving the app, so a foreground return while paused-for-space rechecks
  // free disk and resumes the download when it fits.
  useEffect(() => {
    if (pipeline.phase !== 'setup' || pipeline.setupState !== 'sto') return;
    // A retry remounts the hooks and refetches from byte 0 — expo-file-system
    // resumes only from pauseAsync() resume data, which nothing here persists,
    // so any model not fully on disk costs its whole size again.
    const neededBytes =
      ((modelInstalled(ocrSources()) ? 0 : pipeline.ocrTotalBytes) +
        (modelInstalled(llmSources()) ? 0 : pipeline.llmTotalBytes)) *
      1.8;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && availableDiskBytes() > neededBytes) onRetryModels();
    });
    return () => sub.remove();
  }, [
    pipeline.phase,
    pipeline.setupState,
    pipeline.ocrTotalBytes,
    pipeline.llmTotalBytes,
    onRetryModels,
  ]);

  const handleSave = async (edited: ContactFields) => {
    if (saving) return;
    setSaving(true);
    try {
      await saveToContacts(edited);
      pipeline.completeSave(edited);
    } catch (e) {
      console.warn('save failed', e);
      Alert.alert('Could not open the contact form', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderBase = () => {
    switch (pipeline.phase) {
      case 'setup':
        return (
          <OnboardingScreen
            mode={onboarded ? 'redownload' : 'first-run'}
            setupState={pipeline.setupState}
            ocrProgress={pipeline.ocrProgress}
            llmProgress={pipeline.llmProgress}
            ocrTotalBytes={pipeline.ocrTotalBytes}
            llmTotalBytes={pipeline.llmTotalBytes}
            downloadMbps={pipeline.downloadMbps}
            etaMinutes={pipeline.etaMinutes}
            onStartScanning={() => {
              if (!onboarded) {
                saveSettings({ onboarded: true });
                setOnboarded(true);
              }
              pipeline.beginCapture();
            }}
            onRetryDownload={onRetryModels}
            alreadyInstalled={modelsOnDisk}
          />
        );
      case 'capture':
        return (
          <CaptureScreen
            onImage={(uri) => void pipeline.scanCard(uri)}
            banner={pipeline.scanError}
            onDismissBanner={pipeline.dismissScanError}
            onOpenHistory={() => push({ kind: 'history' })}
            onOpenSettings={() => push({ kind: 'settings' })}
            showCoach={!coachSeen}
            onCoachDone={() => {
              saveSettings({ coachSeen: true });
              setCoachSeen(true);
            }}
            covered={overlays.length > 0}
            pendingScan={pipeline.captureQueued}
          />
        );
      case 'processing':
        return (
          <ProcessingScreen
            stage={pipeline.stage}
            streamText={pipeline.streamText}
            imageUri={pipeline.imageUri}
            imageSize={pipeline.imageSize}
            detections={pipeline.detections}
            llmStartedAt={pipeline.llmStartedAt}
            getTokenCount={pipeline.getGeneratedTokenCount}
            onCancel={() => {
              pipeline.cancel();
              toast('Scan cancelled.');
            }}
          />
        );
      case 'review':
        return (
          <ReviewScreen
            fields={pipeline.fields}
            rawText={pipeline.rawText}
            degraded={pipeline.degraded}
            readSecs={pipeline.readSecs}
            imageUri={pipeline.imageUri}
            saving={saving}
            onSave={(edited) => void handleSave(edited)}
            onRescan={pipeline.rescan}
            onRetryAi={pipeline.retryAi}
          />
        );
      case 'success':
        return (
          <SuccessScreen
            fields={pipeline.fields}
            onScanAnother={pipeline.reset}
            onViewHistory={() => {
              pipeline.reset();
              setOverlays([{ kind: 'history' }]);
            }}
          />
        );
    }
  };

  const renderOverlay = (overlay: Overlay, index: number) => {
    switch (overlay.kind) {
      case 'history':
        return (
          <HistoryScreen
            key={`history-${index}`}
            onBack={pop}
            onOpenDetail={(id) => push({ kind: 'detail', id })}
            onScanCard={startNewScan}
          />
        );
      case 'detail':
        return <DetailScreen key={`detail-${index}`} id={overlay.id} onBack={pop} />;
      case 'settings':
        return (
          <SettingsScreen
            key={`settings-${index}`}
            onBack={pop}
            onOpenModels={() => push({ kind: 'models' })}
            onOpenPrivacy={() => push({ kind: 'privacy' })}
            appearance={appearance}
            onSetAppearance={setAppearance}
          />
        );
      case 'models':
        return <ModelsScreen key={`models-${index}`} onBack={pop} />;
      case 'privacy':
        return (
          <PrivacyScreen key={`privacy-${index}`} onBack={pop} onTryScan={startNewScan} />
        );
    }
  };

  const cameraChromeVisible =
    overlays.length === 0 && (pipeline.phase === 'capture' || pipeline.phase === 'processing');

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Layers under the top overlay stay mounted but must vanish from
          VoiceOver — otherwise swiping reads the hidden screen beneath. */}
      <View style={styles.root} accessibilityElementsHidden={overlays.length > 0}>
        {renderBase()}
      </View>
      {overlays.map((o, i) => (
        <View
          key={`${o.kind}-${i}`}
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden={i < overlays.length - 1}
        >
          {renderOverlay(o, i)}
        </View>
      ))}
      <StatusBar style={cameraChromeVisible || theme.dark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
