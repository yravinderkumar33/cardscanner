import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { historySizeBytes } from '../lib/historyStore';
import {
  allModelsBytes,
  deleteModel,
  emitModelsChanged,
  formatBytes,
  llmSources,
  modelBytesOnDisk,
  modelInstalled,
  ocrSources,
  onModelsChanged,
} from '../lib/modelManager';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { Btn } from './ui/Btn';
import { Card } from './ui/Card';
import { ConfirmSheet } from './ui/ConfirmSheet';
import { IconBadge } from './ui/IconBadge';
import { ScreenHeader } from './ui/ScreenHeader';
import { useToast } from './ui/Toast';
import { Brain, CheckCircle, TextAa } from './ui/icons';

type ModelId = 'ocr' | 'llm';

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

// Segmented storage bar: OCR (accent) · LLM (45% accent) · scans (25% text),
// real proportions with a 2% minimum width for the segments that hold bytes.
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

export function ModelsScreen({ onBack }: { onBack(): void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const pushIn = usePushIn();
  const [tick, bump] = useState(0);
  const [confirm, setConfirm] = useState<{ id: ModelId; bytes: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Deleting a model while it is loaded in memory is safe — the next launch
  // simply re-downloads the files.

  // A delete anywhere (including our own) bumps the tick to refresh the stats.
  useEffect(() => onModelsChanged(() => bump((n) => n + 1)), []);

  // Size stats are sync file I/O — memoize behind the tick instead of
  // re-reading on every render (bump() after a delete refreshes them).
  const { ocrBytes, llmBytes, scanBytes, totalBytes, ocrInstalled, llmInstalled } = useMemo(() => {
    const scans = historySizeBytes();
    return {
      ocrBytes: modelBytesOnDisk(ocrSources()),
      llmBytes: modelBytesOnDisk(llmSources()),
      scanBytes: scans,
      totalBytes: allModelsBytes() + scans,
      ocrInstalled: modelInstalled(ocrSources()),
      llmInstalled: modelInstalled(llmSources()),
    };
  }, [tick]);

  // Remember the last on-disk size so a deleted model's card can still name
  // what the next download will fetch.
  const lastKnown = useRef<Record<ModelId, number>>({ ocr: 0, llm: 0 });
  if (ocrBytes > 0) lastKnown.current.ocr = ocrBytes;
  if (llmBytes > 0) lastKnown.current.llm = llmBytes;

  const models: {
    id: ModelId;
    name: string;
    metaLead: string;
    desc: string;
    bytes: number;
    installed: boolean;
  }[] = [
    {
      id: 'ocr',
      name: 'Text reader (OCR)',
      metaLead: 'CRAFT + CRNN · English',
      desc: 'Finds every patch of text on the photo and reads the characters. Fast — about a second per card.',
      bytes: ocrBytes,
      installed: ocrInstalled,
    },
    {
      id: 'llm',
      name: 'Language model',
      metaLead: 'Qwen 3 0.6B · 4-bit quantized',
      desc: 'Turns the raw text into structured fields — names, numbers, addresses. Runs fully on this iPhone.',
      bytes: llmBytes,
      installed: llmInstalled,
    },
  ];

  const doDelete = async () => {
    const c = confirm;
    if (!c) return;
    setConfirmOpen(false);
    try {
      await deleteModel(c.id === 'ocr' ? ocrSources() : llmSources());
      bump((n) => n + 1);
      toast('Freed — it re-downloads next time you open the app.');
    } catch {
      // A partial delete still changed the disk: tell every listener (Settings
      // stays mounted underneath and only refreshes on this event).
      emitModelsChanged();
      toast('Could not delete the model — try again.');
    }
  };

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, pushIn]}>
      <ScreenHeader title="AI models" onBack={onBack} backLabel="Back to settings" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <View style={styles.storageHead}>
            <Text style={[styles.storageLabel, { color: theme.muted }]}>On this iPhone</Text>
            <Text style={[styles.storageTotal, { color: theme.text }]}>
              {formatBytes(totalBytes)}
            </Text>
          </View>
          <StorageBar ocr={ocrBytes} llm={llmBytes} scans={scanBytes} height={7} />
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: theme.accent }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                OCR {formatBytes(ocrBytes)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: withAlpha(theme.accent, 0.45) }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Language model {formatBytes(llmBytes)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: withAlpha(theme.text, 0.25) }]} />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Scans {formatBytes(scanBytes)}
              </Text>
            </View>
          </View>
        </Card>

        {models.map((m) => {
          const displayBytes = m.bytes > 0 ? m.bytes : lastKnown.current[m.id];
          const meta =
            displayBytes > 0 ? `${m.metaLead} · ${formatBytes(displayBytes)}` : m.metaLead;
          return (
            <Card key={m.id} style={styles.card}>
              <View style={styles.modelHead}>
                <IconBadge size={34} radius={10}>
                  {m.id === 'ocr' ? (
                    <TextAa size={18} color={theme.accentBright} />
                  ) : (
                    <Brain size={18} color={theme.accentBright} />
                  )}
                </IconBadge>
                <View style={styles.modelTitleBlock}>
                  <Text style={[styles.modelName, { color: theme.text }]}>{m.name}</Text>
                  <Text style={[styles.modelMeta, { color: theme.muted }]}>{meta}</Text>
                </View>
                {m.installed ? (
                  <View style={styles.installedBadge}>
                    <CheckCircle size={14} color={theme.accentBright} />
                    <Text style={[styles.installedText, { color: theme.accentBright }]}>
                      Installed
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.pendingText, { color: theme.warning }]}>
                    Re-downloads on next launch
                  </Text>
                )}
              </View>
              <Text style={[styles.modelDesc, { color: theme.muted }]}>{m.desc}</Text>
              {m.installed && (
                <Btn
                  label="Delete & re-download later"
                  variant="danger"
                  size="sm"
                  onPress={() => {
                    setConfirm({ id: m.id, bytes: m.bytes });
                    setConfirmOpen(true);
                  }}
                  style={styles.deleteBtn}
                />
              )}
            </Card>
          );
        })}

        <Text style={[styles.footNote, { color: theme.faint }]}>
          Deleting a model frees space immediately. Scanning keeps working until you close the app;
          the next launch needs Wi-Fi to fetch it again — your history is never touched.
        </Text>
      </ScrollView>
      <ConfirmSheet
        visible={confirmOpen}
        title={confirm?.id === 'ocr' ? 'Delete the text reader?' : 'Delete the language model?'}
        body={`Frees ${formatBytes(confirm?.bytes ?? 0)} now. Scanning keeps working until you close the app; the next launch needs Wi-Fi to fetch it again.`}
        confirmLabel="Delete model"
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingTop: 8, paddingHorizontal: 18, paddingBottom: 40 },
  card: { paddingVertical: 13, paddingHorizontal: 14, marginBottom: 14 },
  storageHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 9,
  },
  storageLabel: { fontSize: 13, fontFamily: font.regular },
  storageTotal: { fontSize: 16, fontFamily: font.medium },
  bar: { flexDirection: 'row', gap: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10.5, fontFamily: font.regular },
  modelHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 6 },
  modelTitleBlock: { flex: 1, minWidth: 0 },
  modelName: { fontSize: 14, fontFamily: font.medium },
  modelMeta: { fontSize: 11.5, fontFamily: font.regular, marginTop: 1 },
  installedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  installedText: { fontSize: 11, fontFamily: font.regular },
  pendingText: {
    fontSize: 11,
    fontFamily: font.regular,
    maxWidth: 110,
    textAlign: 'right',
  },
  modelDesc: { fontSize: 12, lineHeight: 18, fontFamily: font.regular, marginBottom: 10 },
  deleteBtn: { alignSelf: 'flex-start' },
  footNote: {
    fontSize: 11.5,
    lineHeight: 18.5,
    fontFamily: font.regular,
    paddingHorizontal: 4,
  },
});
