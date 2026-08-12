import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { saveToContacts } from '../lib/contacts';
import { scannedLabel } from '../lib/dates';
import { deleteScan, loadHistory, photoUriFor, updateScan } from '../lib/historyStore';
import { buildVCard, vcardFilename } from '../lib/vcard';
import { font } from '../theme/fonts';
import { TOP_INSET } from '../theme/layout';
import { useTheme } from '../theme/ThemeContext';
import { Btn } from './ui/Btn';
import { Card } from './ui/Card';
import { ConfirmSheet } from './ui/ConfirmSheet';
import {
  Buildings,
  Cards,
  CaretLeft,
  Copy,
  EnvelopeSimple,
  Export,
  GlobeSimple,
  MapPin,
  Phone,
  TrashSimple,
  User,
  UserPlus,
} from './ui/icons';
import { useToast } from './ui/Toast';

// Scan detail: the card photo, tap-to-copy field rows, and the re-save /
// share / delete actions. Everything reads from the local history store.

interface InfoRow {
  key: string;
  label: string;
  value: string;
  Icon: typeof User;
}

export function DetailScreen({ id, onBack }: { id: string; onBack(): void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  const record = useMemo(() => loadHistory().find((r) => r.id === id), [id]);

  // A deleted/unknown id has nothing to show — bounce back to History.
  useEffect(() => {
    if (!record) onBack();
  }, [record, onBack]);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [enter]);

  const copyRow = useCallback(
    async (value: string) => {
      try {
        await Clipboard.setStringAsync(value);
      } catch (e) {
        console.warn('clipboard copy failed', e);
      }
      toast(`Copied “${value.length > 26 ? `${value.slice(0, 26)}…` : value}”`);
    },
    [toast]
  );

  if (!record) return null;

  const f = record.fields;
  const personName = [f.firstName, f.lastName].filter(Boolean).join(' ');
  const name = personName || f.company || 'Scanned card';
  const photoUri = photoUriFor(record);

  const rows: InfoRow[] = [];
  if (personName) rows.push({ key: 'name', label: 'Name', value: personName, Icon: User });
  const coTitle =
    f.company && f.jobTitle ? `${f.company} — ${f.jobTitle}` : f.company || f.jobTitle || '';
  if (coTitle) rows.push({ key: 'co', label: 'Company · title', value: coTitle, Icon: Buildings });
  f.phones.forEach((p, i) => {
    if (p.trim()) rows.push({ key: `ph${i}`, label: 'Phone', value: p, Icon: Phone });
  });
  f.emails.forEach((em, i) => {
    if (em.trim()) rows.push({ key: `em${i}`, label: 'Email', value: em, Icon: EnvelopeSimple });
  });
  if (f.website) rows.push({ key: 'web', label: 'Website', value: f.website, Icon: GlobeSimple });
  if (f.address) rows.push({ key: 'ad', label: 'Address', value: f.address, Icon: MapPin });

  const resave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveToContacts(f);
      updateScan(record.id, { savedToContacts: true });
      // iOS cannot report whether the native form was confirmed or
      // cancelled, so the wording stays honest about that.
      toast('Contact form closed — saved if you tapped Done.');
    } catch (e) {
      console.warn('contacts save failed', e);
    } finally {
      setBusy(false);
    }
  };

  const shareVcf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) return;
      const file = new File(Paths.cache, vcardFilename(f));
      if (file.exists) file.delete();
      file.write(buildVCard(f));
      // Deliberately NOT awaited: shareAsync's promise never settles when the
      // user cancels inside a share activity (verified in SharingModule.swift),
      // so gating `busy` on it would wedge the button forever.
      Sharing.shareAsync(file.uri, { mimeType: 'text/vcard', UTI: 'public.vcard' }).catch((e) =>
        console.warn('share vcf failed', e)
      );
    } catch (e) {
      console.warn('share vcf failed', e);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    setConfirmVisible(false);
    deleteScan(record.id);
    toast('Scan deleted from this phone.');
    onBack();
  };

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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to history"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backChip,
            { borderColor: theme.divider },
            pressed && {
              backgroundColor: theme.dark ? 'rgba(233,233,237,0.07)' : 'rgba(41,43,49,0.06)',
            },
          ]}
        >
          <CaretLeft size={17} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.headerName, { color: theme.text }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: theme.muted }]}>
            {scannedLabel(record.createdAt)} · read on-device
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.photoCard, { shadowOpacity: theme.shadowOpacity }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: theme.surface2 }]}>
              <Cards size={34} color={theme.muted} />
            </View>
          )}
        </View>

        {rows.length > 0 && (
          <Card style={styles.infoCard}>
            {rows.map((r, i) => {
              const RowIcon = r.Icon;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}, ${r.value}`}
                  accessibilityHint="Copies to clipboard"
                  onPress={() => {
                    void copyRow(r.value);
                  }}
                  style={({ pressed }) => [
                    styles.infoRow,
                    {
                      borderBottomColor: i === rows.length - 1 ? 'transparent' : theme.divider,
                    },
                    pressed && {
                      backgroundColor: theme.dark ? 'rgba(233,233,237,0.04)' : 'rgba(41,43,49,0.04)',
                    },
                  ]}
                >
                  <RowIcon size={16} color={theme.muted} />
                  <View style={styles.infoText}>
                    <Text style={[styles.infoLabel, { color: theme.muted }]}>{r.label}</Text>
                    <Text numberOfLines={1} style={[styles.infoValue, { color: theme.text }]}>
                      {r.value}
                    </Text>
                  </View>
                  <Copy size={14} color={theme.faint} />
                </Pressable>
              );
            })}
          </Card>
        )}

        <View style={styles.actions}>
          <Btn
            label="Add to Contacts again"
            onPress={() => {
              void resave();
            }}
            variant="primary"
            icon={<UserPlus size={16} color={theme.accentBright} />}
            disabled={busy}
            style={styles.primaryBtn}
            textStyle={styles.primaryBtnText}
          />
          <View style={styles.actionRow}>
            <Btn
              label="Share .vcf"
              onPress={() => {
                void shareVcf();
              }}
              variant="secondary"
              size="md"
              icon={<Export size={15} color={theme.text} />}
              disabled={busy}
              style={styles.halfBtn}
            />
            <Btn
              label="Delete scan"
              onPress={() => setConfirmVisible(true)}
              variant="danger"
              size="md"
              icon={<TrashSimple size={15} color={theme.danger} />}
              style={styles.halfBtn}
            />
          </View>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmVisible}
        title="Delete this scan?"
        body="Removed from this phone only — anything you saved to iOS Contacts stays."
        confirmLabel="Delete scan"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 20, fontFamily: font.medium, letterSpacing: -0.4 },
  headerSub: { fontSize: 11.5, fontFamily: font.regular, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingHorizontal: 18, paddingBottom: 40 },
  photoCard: {
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  photo: { width: '100%', height: 196, borderRadius: 12 },
  photoPlaceholder: {
    width: '100%',
    height: 196,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: { marginBottom: 16 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  infoText: { flex: 1, minWidth: 0 },
  infoLabel: {
    fontSize: 10.5,
    letterSpacing: 0.42,
    textTransform: 'uppercase',
    fontFamily: font.regular,
  },
  infoValue: { fontSize: 14.5, fontFamily: font.regular },
  actions: { gap: 8 },
  primaryBtn: { paddingVertical: 12 },
  primaryBtnText: { fontSize: 14.5 },
  actionRow: { flexDirection: 'row', gap: 8 },
  halfBtn: { flex: 1, paddingVertical: 11, borderRadius: 12 },
});
