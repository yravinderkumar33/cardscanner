import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sectionLabel, whenLabel } from '../lib/dates';
import {
  deleteScan,
  historySizeBytes,
  loadHistory,
  onHistoryChanged,
  thumbUriFor,
  ScanRecord,
} from '../lib/historyStore';
import { formatBytes } from '../lib/modelManager';
import { ContactFields } from '../lib/schema';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { ConfirmSheet } from './ui/ConfirmSheet';
import { Cards, CaretRight, LockSimple, MagnifyingGlass, TrashSimple, XCircle } from './ui/icons';
import { ScreenHeader } from './ui/ScreenHeader';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';

// History: the local-only scan library. Search, swipe-to-delete, tap-through
// to detail — and an empty state that says the privacy promise out loud.

const SWIPE_MAX = -80;
const SWIPE_OPEN_AT = -40;
const NO_CLICK_MS = 350;

function displayName(fields: ContactFields): string {
  return (
    [fields.firstName, fields.lastName].filter(Boolean).join(' ') ||
    fields.company ||
    'Scanned card'
  );
}

// Shimmer widths from the prototype's four skeleton rows (design 739–743).
const SKELETON_ROWS = [
  { w1: '60%', w2: '38%', op: 1 },
  { w1: '52%', w2: '44%', op: 1 },
  { w1: '64%', w2: '33%', op: 1 },
  { w1: '48%', w2: '40%', op: 0.6 },
] as const;

function HistoryRow({
  record,
  onPressRow,
  onAskDelete,
  onDragStart,
  onSnap,
}: {
  record: ScanRecord;
  onPressRow(id: string): void;
  onAskDelete(id: string): void;
  /** A drag began on this row — close any other open row. */
  onDragStart(id: string): void;
  /** The row snapped open (true) or closed (false) after a drag. */
  onSnap(id: string, open: boolean, close: () => void): void;
}) {
  const { theme } = useTheme();
  const tx = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const base = useRef(0);

  // Latest callbacks/state, readable from the once-created PanResponder.
  const cbs = useRef({ onDragStart, onSnap });
  cbs.current = { onDragStart, onSnap };

  const close = useCallback(() => {
    isOpen.current = false;
    Animated.timing(tx, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [tx]);
  const closeRef = useRef(close);
  closeRef.current = close;
  // Stable identity handed to the parent so it can close this row later.
  const stableClose = useRef(() => closeRef.current()).current;

  const pan = useRef(
    PanResponder.create({
      // Horizontal-only capture: let vertical scrolling through untouched.
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        base.current = isOpen.current ? SWIPE_MAX : 0;
        cbs.current.onDragStart(record.id);
      },
      onPanResponderMove: (_e, g) => {
        tx.setValue(Math.max(SWIPE_MAX, Math.min(0, base.current + g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        const open = base.current + g.dx < SWIPE_OPEN_AT;
        isOpen.current = open;
        Animated.timing(tx, {
          toValue: open ? SWIPE_MAX : 0,
          duration: 220,
          useNativeDriver: true,
        }).start();
        cbs.current.onSnap(record.id, open, stableClose);
      },
      onPanResponderTerminate: (_e, g) => {
        const open = base.current + g.dx < SWIPE_OPEN_AT;
        isOpen.current = open;
        Animated.timing(tx, {
          toValue: open ? SWIPE_MAX : 0,
          duration: 220,
          useNativeDriver: true,
        }).start();
        cbs.current.onSnap(record.id, open, stableClose);
      },
    })
  ).current;

  const uri = thumbUriFor(record);
  const paneBg = theme.dark ? 'rgba(224,138,132,0.85)' : 'rgba(180,82,77,0.85)';

  return (
    <View style={styles.rowOuter}>
      <View style={[styles.deletePane, { backgroundColor: paneBg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete scan"
          onPress={() => onAskDelete(record.id)}
          style={styles.deleteBtn}
        >
          <TrashSimple size={19} color="#f3f5fe" />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: tx }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open scan ${displayName(record.fields)}`}
          // VoiceOver can't perform the swipe gesture — expose delete as a
          // rotor action instead.
          accessibilityActions={[{ name: 'delete', label: 'Delete scan' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'delete') onAskDelete(record.id);
          }}
          onPress={() => onPressRow(record.id)}
          style={({ pressed }) => [
            styles.rowContent,
            { backgroundColor: pressed ? theme.surface : theme.bg },
          ]}
        >
          <View style={styles.thumbWrap}>
            {uri ? (
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumbPlaceholder, { backgroundColor: theme.surface2 }]}>
                <Cards size={16} color={theme.muted} />
              </View>
            )}
          </View>
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={[styles.rowName, { color: theme.text }]}>
              {displayName(record.fields)}
            </Text>
            <Text numberOfLines={1} style={[styles.rowSub, { color: theme.muted }]}>
              {record.fields.company || '—'}
            </Text>
          </View>
          <Text style={[styles.rowWhen, { color: theme.faint }]}>{whenLabel(record.createdAt)}</Text>
          <CaretRight size={14} color={theme.faint} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function HistoryScreen({
  onBack,
  onOpenDetail,
  onScanCard,
}: {
  onBack(): void;
  onOpenDetail(id: string): void;
  onScanCard(): void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const [records, setRecords] = useState<ScanRecord[] | null>(null);
  const [sizeBytes, setSizeBytes] = useState(0);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const openRow = useRef<{ id: string; close(): void } | null>(null);
  const noClickAt = useRef(0);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [enter]);

  const refresh = useCallback(() => {
    setRecords(loadHistory());
    setSizeBytes(historySizeBytes());
  }, []);

  // First render shows the skeleton; the sync load swaps data in right after
  // mount — no artificial delay. The store subscription keeps the list live
  // while Detail (pushed on top of this still-mounted screen) deletes or
  // updates records, and when thumbnails finish generating.
  useEffect(() => {
    refresh();
    return onHistoryChanged(refresh);
  }, [refresh]);

  const closeOpenRow = useCallback(() => {
    if (openRow.current) {
      openRow.current.close();
      openRow.current = null;
    }
  }, []);

  const handleDragStart = useCallback((id: string) => {
    if (openRow.current && openRow.current.id !== id) {
      openRow.current.close();
      openRow.current = null;
    }
  }, []);

  const handleSnap = useCallback((id: string, open: boolean, close: () => void) => {
    noClickAt.current = Date.now();
    if (open) openRow.current = { id, close };
    else if (openRow.current?.id === id) openRow.current = null;
  }, []);

  // Port of the prototype's _noClick guard: a tap right after a swipe, or
  // while some row is open, just settles the list instead of navigating.
  const handleRowPress = useCallback(
    (id: string) => {
      if (Date.now() - noClickAt.current < NO_CLICK_MS) return;
      if (openRow.current) {
        closeOpenRow();
        return;
      }
      onOpenDetail(id);
    },
    [closeOpenRow, onOpenDetail]
  );

  const askDelete = useCallback((id: string) => setConfirmId(id), []);

  const confirmDelete = useCallback(() => {
    if (confirmId == null) return;
    deleteScan(confirmId);
    openRow.current = null;
    setConfirmId(null);
    refresh();
    toast('Scan deleted from this phone.');
  }, [confirmId, refresh, toast]);

  const cancelDelete = useCallback(() => {
    setConfirmId(null);
    closeOpenRow();
  }, [closeOpenRow]);

  const loading = records == null;
  const all = records ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? all.filter((r) =>
        `${r.fields.firstName ?? ''} ${r.fields.lastName ?? ''} ${r.fields.company ?? ''}`
          .toLowerCase()
          .includes(q)
      )
    : all;

  const sections: { label: string; items: ScanRecord[] }[] = [];
  for (const r of filtered) {
    const label = sectionLabel(r.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(r);
    else sections.push({ label, items: [r] });
  }

  const meta =
    all.length === 0
      ? 'on this phone only'
      : `${all.length} ${all.length === 1 ? 'scan' : 'scans'} · ${formatBytes(sizeBytes)}`;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          opacity: enter,
          transform: [
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) },
          ],
        },
      ]}
    >
      <ScreenHeader
        title="History"
        onBack={onBack}
        backLabel="Back to camera"
        trailing={
          <View style={styles.metaRow}>
            <LockSimple size={12} color={theme.faint} />
            <Text style={[styles.metaText, { color: theme.faint }]}>{meta}</Text>
          </View>
        }
      />

      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.surface,
              borderColor: theme.ring,
              shadowOpacity: theme.dark ? 0 : 0.1,
            },
          ]}
        >
          <MagnifyingGlass size={15} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or company"
            placeholderTextColor={theme.faint}
            accessibilityLabel="Search scans"
            selectionColor={theme.accent}
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search !== '' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch('')}
              hitSlop={8}
            >
              <XCircle size={15} color={theme.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.skeletonWrap}>
            {SKELETON_ROWS.map((row, i) => (
              <View key={i} style={[styles.skelRow, { opacity: row.op }]}>
                <Skeleton style={styles.skelThumb} />
                <View style={styles.skelLines}>
                  <Skeleton style={{ width: row.w1, height: 11, borderRadius: 5, marginBottom: 7 }} />
                  <Skeleton style={{ width: row.w2, height: 9, borderRadius: 5 }} />
                </View>
              </View>
            ))}
            <Text style={[styles.skelNote, { color: theme.faint }]}>Opening your local library…</Text>
          </View>
        ) : all.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyArt}>
              <View style={[styles.emptyCardBack, { backgroundColor: theme.surface }]} />
              <View style={[styles.emptyCardFront, { backgroundColor: theme.surface2 }]}>
                <Cards size={26} color={theme.muted} />
              </View>
            </View>
            <View style={styles.emptyTextWrap}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No scans yet</Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Cards you scan stay here — on this phone, nowhere else.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onScanCard}
              style={({ pressed }) => [
                styles.emptyBtn,
                {
                  borderColor: theme.accent,
                  backgroundColor: pressed ? theme.accentTint : 'transparent',
                },
              ]}
            >
              <Text style={[styles.emptyBtnText, { color: theme.accentBright }]}>Scan a card</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={[styles.noResults, { color: theme.muted }]}>
            Nothing matches “{search}”
          </Text>
        ) : (
          <>
            {sections.map((sec) => (
              <View key={sec.label}>
                <Text style={[styles.sectionHeader, { color: theme.muted }]}>{sec.label}</Text>
                {sec.items.map((r) => (
                  <HistoryRow
                    key={r.id}
                    record={r}
                    onPressRow={handleRowPress}
                    onAskDelete={askDelete}
                    onDragStart={handleDragStart}
                    onSnap={handleSnap}
                  />
                ))}
              </View>
            ))}
            <Text style={[styles.footerHint, { color: theme.faint }]}>
              Swipe a row left to delete · nothing here ever syncs
            </Text>
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={confirmId != null}
        title="Delete this scan?"
        body="Removed from this phone only — anything you saved to iOS Contacts stays."
        confirmLabel="Delete scan"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, fontFamily: font.regular },
  searchWrap: { paddingHorizontal: 18, marginTop: 4, paddingBottom: 6 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#292b31',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: font.regular, padding: 0 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 40 },
  skeletonWrap: { paddingVertical: 6, paddingHorizontal: 4, gap: 10 },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skelThumb: { width: 58, height: 36, borderRadius: 6 },
  skelLines: { flex: 1 },
  skelNote: { textAlign: 'center', fontSize: 11, fontFamily: font.regular, marginTop: 8 },
  sectionHeader: {
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    fontFamily: font.regular,
    marginTop: 12,
    marginHorizontal: 6,
    marginBottom: 6,
  },
  rowOuter: { position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 2 },
  deletePane: {
    position: 'absolute',
    top: 4,
    right: 0,
    bottom: 4,
    width: 74,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { alignItems: 'center', gap: 2 },
  deleteText: { color: '#f3f5fe', fontSize: 10, fontFamily: font.medium },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
  },
  thumbWrap: {
    width: 58,
    height: 36,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
  },
  thumb: { width: 58, height: 36, borderRadius: 6 },
  thumbPlaceholder: {
    width: 58,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14.5, fontFamily: font.medium },
  rowSub: { fontSize: 12, fontFamily: font.regular },
  rowWhen: { fontSize: 10.5, fontFamily: font.regular },
  footerHint: { textAlign: 'center', fontSize: 11, fontFamily: font.regular, marginTop: 16 },
  noResults: {
    textAlign: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    fontSize: 13.5,
    fontFamily: font.regular,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 30, gap: 14 },
  emptyArt: { width: 96, height: 70 },
  emptyCardBack: {
    position: 'absolute',
    top: 8,
    left: 6,
    right: 6,
    height: 52,
    borderRadius: 7,
    transform: [{ rotate: '-6deg' }],
  },
  emptyCardFront: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 56,
    borderRadius: 7,
    transform: [{ rotate: '3deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextWrap: { alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontFamily: font.medium, marginBottom: 5 },
  emptyBody: {
    fontSize: 13,
    fontFamily: font.regular,
    lineHeight: 20,
    maxWidth: 250,
    textAlign: 'center',
  },
  emptyBtn: { paddingVertical: 11, paddingHorizontal: 24, borderRadius: 11, borderWidth: 1 },
  emptyBtnText: { fontSize: 14, fontFamily: font.medium },
});
