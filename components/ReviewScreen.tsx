import * as Clipboard from 'expo-clipboard';
import { ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import {
  emailLooksValid,
  FIELD_LABELS,
  FieldKey,
  guessLineField,
  phoneLooksValid,
  titleCaseIfShouty,
} from '../lib/fieldGuess';
import { ContactFields } from '../lib/schema';
import { font } from '../theme/fonts';
import { BOTTOM_INSET, TOP_INSET } from '../theme/layout';
import { useTheme } from '../theme/ThemeContext';
import { Card, SectionLabel } from './ui/Card';
import {
  ArrowCounterClockwise,
  Buildings,
  CaretLeft,
  Check,
  Copy,
  EnvelopeSimple,
  FileText,
  GlobeSimple,
  HandTap,
  IdentificationBadge,
  MapPin,
  Phone,
  Plus,
  PlusCircle,
  Sparkle,
  User,
  UserPlus,
  WarningCircle,
  X,
} from './ui/icons';
import { Sheet } from './ui/Sheet';
import { useToast } from './ui/Toast';

// ── Internal editable state ─────────────────────────────────────────────────

type IconComponent = ComponentType<{ size?: number; color?: string; weight?: 'regular' | 'fill' | 'bold' }>;
type ScalarKey = 'fn' | 'ln' | 'co' | 'jt' | 'web' | 'ad';
type ListKey = 'phones' | 'emails';

interface EditFields {
  fn: string;
  ln: string;
  co: string;
  jt: string;
  phones: string[];
  emails: string[];
  web: string;
  ad: string;
}

interface AiFlags {
  fn: boolean;
  ln: boolean;
  co: boolean;
  jt: boolean;
  web: boolean;
  ad: boolean;
  phones: boolean[];
  emails: boolean[];
}

function initEdit(fields: ContactFields): EditFields {
  return {
    fn: fields.firstName ?? '',
    ln: fields.lastName ?? '',
    co: fields.company ?? '',
    jt: fields.jobTitle ?? '',
    phones: fields.phones.length > 0 ? [...fields.phones] : [''],
    emails: fields.emails.length > 0 ? [...fields.emails] : [''],
    web: fields.website ?? '',
    ad: fields.address ?? '',
  };
}

// Sparkles mirror what the AI filled: everything non-empty when the parse
// succeeded, nothing in degraded mode (values there are user-placed).
function initAi(edit: EditFields, degraded: boolean): AiFlags {
  const on = !degraded;
  return {
    fn: on && edit.fn !== '',
    ln: on && edit.ln !== '',
    co: on && edit.co !== '',
    jt: on && edit.jt !== '',
    web: on && edit.web !== '',
    ad: on && edit.ad !== '',
    phones: edit.phones.map((p) => on && p !== ''),
    emails: edit.emails.map((e) => on && e !== ''),
  };
}

// ── Field row (label + borderless input + kfField cascade) ──────────────────

function FieldRow({
  icon: Icon,
  label,
  value,
  ai,
  placeholder,
  warn,
  delay,
  divider,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  ai: boolean;
  placeholder: string;
  warn: string | null;
  delay: number;
  divider: boolean;
  onChangeText(v: string): void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 400, delay, useNativeDriver: true }).start();
    // Entrance runs once per mounted row; delay is fixed at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.row,
        {
          borderBottomColor: divider ? theme.divider : 'transparent',
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
        },
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon size={16} color={theme.muted} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.labelRow}>
          <Text style={[styles.rowLabel, { color: theme.muted }]}>{label}</Text>
          {ai && (
            <View accessible accessibilityLabel="Filled by on-device AI">
              <Sparkle size={11} color={theme.accent} weight="fill" />
            </View>
          )}
        </View>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.faint}
          selectionColor={theme.accent}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          accessibilityLabel={label}
        />
        {warn != null && (
          <View style={styles.warnRow}>
            <WarningCircle size={11} color={theme.warning} />
            <Text style={[styles.warnText, { color: theme.warning }]}>{warn}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

// How much of the save bar's home-indicator padding is tucked behind the
// keyboard while it is up, leaving a 14 pt gap above the keys.
const SAVE_BAR_KB_OVERLAP = BOTTOM_INSET - 14;

// What a raw line wrote, so re-assigning the same line can undo its last write.
interface Placement {
  scalars: Partial<Record<ScalarKey, string>>;
  list?: ListKey;
  slot?: number;
}

export function ReviewScreen({
  fields,
  rawText,
  degraded,
  readSecs,
  imageUri,
  saving,
  onSave,
  onRescan,
  onRetryAi,
}: {
  fields: ContactFields;
  rawText: string;
  degraded: boolean;
  readSecs: string | null;
  imageUri: string | null;
  saving: boolean;
  onSave(edited: ContactFields): void;
  onRescan(): void;
  onRetryAi(): void;
}) {
  const { theme } = useTheme();
  const toast = useToast();

  const [edit, setEdit] = useState<EditFields>(() => initEdit(fields));
  const [aiSet, setAiSet] = useState<AiFlags>(() => initAi(initEdit(fields), degraded));
  const [used, setUsed] = useState<Record<number, FieldKey>>({});
  const [rawOpen, setRawOpen] = useState(false);
  const [assign, setAssign] = useState<{ i: number; t: string } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [photoAr, setPhotoAr] = useState(222 / 137);
  const [saveBarH, setSaveBarH] = useState(120);

  const placed = useRef<Record<number, Placement>>({});

  // Re-init when the AI produces new fields (e.g. "Run the AI once more").
  const [prevFields, setPrevFields] = useState(fields);
  const cascadeDone = useRef(false);
  if (prevFields !== fields) {
    setPrevFields(fields);
    const nextEdit = initEdit(fields);
    setEdit(nextEdit);
    setAiSet(initAi(nextEdit, degraded));
    setUsed({});
    placed.current = {};
    setAssign(null);
    setGeneration((g) => g + 1);
    cascadeDone.current = false;
  }

  const rootAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rootAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [rootAnim]);
  useEffect(() => {
    cascadeDone.current = true;
  });

  // The save bar is absolutely positioned at the screen bottom, so it has to be
  // lifted by hand: automaticallyAdjustKeyboardInsets only insets the ScrollView.
  const kbLift = useRef(new Animated.Value(0)).current;
  // Lifted, the bar covers live content instead of empty page bottom, so its
  // fade-to-background has to become opaque or fields show through the button.
  const [kbUp, setKbUp] = useState(false);
  useEffect(() => {
    const lift = (h: number, duration: number) => {
      setKbUp(h > 0);
      Animated.timing(kbLift, {
        toValue: h > 0 ? -Math.max(0, h - SAVE_BAR_KB_OVERLAP) : 0,
        duration: duration > 0 ? duration : 250,
        useNativeDriver: true,
      }).start();
    };
    // willChangeFrame also covers swapping between keyboards of different heights.
    const onFrame = Keyboard.addListener('keyboardWillChangeFrame', (e) =>
      lift(Dimensions.get('window').height - e.endCoordinates.screenY, e.duration)
    );
    const onHide = Keyboard.addListener('keyboardWillHide', (e) => lift(0, e.duration));
    return () => {
      onFrame.remove();
      onHide.remove();
    };
  }, [kbLift]);

  const rawLines = useMemo(
    () => rawText.split('\n').map((l) => l.trim()).filter((l) => l !== ''),
    [rawText]
  );

  // Keep the assign sheet's content during its exit animation.
  const lastAssign = useRef<{ i: number; t: string } | null>(null);
  if (assign != null) lastAssign.current = assign;
  const assignView = assign ?? lastAssign.current;
  const assignGuess = assignView ? guessLineField(assignView.t, assignView.i) : null;

  // ── Edits ─────────────────────────────────────────────────────────────────

  const editScalar = (k: ScalarKey, v: string) => {
    setEdit((e) => ({ ...e, [k]: v }));
    setAiSet((a) => ({ ...a, [k]: false }));
  };
  const editEntry = (k: ListKey, i: number, v: string) => {
    setEdit((e) => {
      const arr = e[k].slice();
      arr[i] = v;
      return { ...e, [k]: arr };
    });
    setAiSet((a) => {
      const arr = a[k].slice();
      arr[i] = false;
      return { ...a, [k]: arr };
    });
  };
  const addEntry = (k: ListKey) => {
    setEdit((e) => ({ ...e, [k]: e[k].concat('') }));
    setAiSet((a) => ({ ...a, [k]: a[k].concat(false) }));
  };

  const copyLine = (t: string) => {
    void Clipboard.setStringAsync(t);
    toast(`Copied “${t.length > 26 ? `${t.slice(0, 26)}…` : t}”`);
  };

  // Degraded assign flow — ported verbatim from the prototype's assignTo.
  const assignTo = (k: FieldKey | 'copy') => {
    const a = assign;
    if (a == null) return;
    if (k === 'copy') {
      void Clipboard.setStringAsync(a.t);
      setAssign(null);
      toast('Copied — paste it anywhere');
      return;
    }
    const next: EditFields = { ...edit };
    const nextAi: AiFlags = { ...aiSet };

    // Re-assigning a line: take the value back out of wherever it went last
    // time, unless the user has since edited that field by hand.
    const prev = placed.current[a.i];
    if (prev != null) {
      for (const [sk, v] of Object.entries(prev.scalars) as [ScalarKey, string][]) {
        if (next[sk] === v) {
          next[sk] = '';
          nextAi[sk] = false;
        }
      }
      if (prev.list != null && prev.slot != null && next[prev.list][prev.slot] === a.t) {
        // Blank the slot rather than splicing it: the next assign reuses it
        // (no duplicate push) and the aiSet flags stay index-aligned.
        const arr = next[prev.list].slice();
        arr[prev.slot] = '';
        next[prev.list] = arr;
        const flags = nextAi[prev.list].slice();
        flags[prev.slot] = false;
        nextAi[prev.list] = flags;
      }
    }

    let msg = `Added to ${FIELD_LABELS[k]}`;
    if (k === 'phones' || k === 'emails') {
      const arr = next[k].slice();
      const flags = nextAi[k].slice();
      const slot = arr.findIndex((x) => !x);
      if (slot >= 0) {
        arr[slot] = a.t;
        flags[slot] = false;
      } else {
        arr.push(a.t);
        flags.push(false);
      }
      next[k] = arr;
      nextAi[k] = flags;
      placed.current[a.i] = { scalars: {}, list: k, slot: slot >= 0 ? slot : arr.length - 1 };
    } else if (k === 'fn' && a.t.trim().indexOf(' ') > 0) {
      const parts = titleCaseIfShouty(a.t.trim()).split(/\s+/);
      next.fn = parts[0] ?? '';
      next.ln = parts.slice(1).join(' ');
      nextAi.fn = false;
      nextAi.ln = false;
      msg = 'Split into first & last name';
      placed.current[a.i] = { scalars: { fn: next.fn, ln: next.ln } };
    } else {
      next[k] = k === 'fn' || k === 'ln' || k === 'co' || k === 'jt' ? titleCaseIfShouty(a.t) : a.t;
      nextAi[k] = false;
      placed.current[a.i] = { scalars: { [k]: next[k] } };
    }
    setEdit(next);
    setAiSet(nextAi);
    setUsed((u) => ({ ...u, [a.i]: k }));
    setAssign(null);
    toast(msg);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const nonBlank = (s: string) => s.trim() !== '';
  const canSave = nonBlank(edit.fn) || nonBlank(edit.ln) || edit.phones.some(nonBlank) || edit.emails.some(nonBlank);

  const handleSave = () => {
    if (!canSave) {
      toast('Add a name or a number first — the card text can help.');
      return;
    }
    if (saving) return;
    const edited: ContactFields = {
      phones: edit.phones.map((p) => p.trim()).filter((p) => p !== ''),
      emails: edit.emails.map((e) => e.trim()).filter((e) => e !== ''),
    };
    const fn = edit.fn.trim();
    if (fn) edited.firstName = fn;
    const ln = edit.ln.trim();
    if (ln) edited.lastName = ln;
    const co = edit.co.trim();
    if (co) edited.company = co;
    const jt = edit.jt.trim();
    if (jt) edited.jobTitle = jt;
    const web = edit.web.trim();
    if (web) edited.website = web;
    const ad = edit.ad.trim();
    if (ad) edited.address = ad;
    onSave(edited);
  };

  // ── Row cascade (kfField, 55 ms stagger, capped like the prototype) ───────

  const initialCascade = !cascadeDone.current;
  let seq = 0;
  const nextDelay = () => (initialCascade ? Math.min(seq++ * 55, 660) : 0);

  const scalarPh = degraded ? 'Tap a line above to fill' : '';
  const placedN = Object.keys(used).length;
  const g = generation;

  return (
    <Animated.View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          opacity: rootAnim,
          transform: [{ translateY: rootAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to camera"
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          onPress={onRescan}
          style={({ pressed }) => [
            styles.backChip,
            {
              borderColor: theme.divider,
              backgroundColor: pressed
                ? theme.dark
                  ? 'rgba(233,233,237,0.07)'
                  : 'rgba(41,43,49,0.07)'
                : 'transparent',
            },
          ]}
        >
          <CaretLeft size={17} color={theme.text} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={[styles.title, { color: theme.text }]}>Check the details</Text>
          <View style={styles.subRow}>
            {degraded ? (
              <Text style={[styles.subText, { color: theme.muted }]}>Read on-device · needs a hand</Text>
            ) : (
              <>
                <Sparkle size={12} color={theme.accent} weight="fill" />
                <Text style={[styles.subText, { color: theme.muted }]} numberOfLines={1}>
                  {readSecs != null
                    ? `Read on-device in ${readSecs} — tap any field to fix it`
                    : 'Read on-device — tap any field to fix it'}
                </Text>
              </>
            )}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show card photo and raw text"
          onPress={() => setRawOpen(true)}
          style={({ pressed }) => [styles.thumb, { borderColor: theme.divider, opacity: pressed ? 0.8 : 1 }]}
        >
          {imageUri != null ? (
            <Image source={{ uri: imageUri }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <View style={styles.thumbFallback}>
              <View style={styles.thumbBar1} />
              <View style={styles.thumbBar2} />
              <View style={styles.thumbBar3} />
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: saveBarH + 16 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {/* Degraded lead + raw lines */}
          {degraded && (
            <>
              <Card style={styles.leadCard}>
                <View
                  style={[styles.leadTile, { backgroundColor: theme.accentTint, borderColor: theme.accentBorder }]}
                >
                  <HandTap size={22} color={theme.accentBright} />
                </View>
                <Text style={[styles.leadTitle, { color: theme.text }]}>
                  The AI read it — it just couldn't sort it
                </Text>
                <Text style={[styles.leadBody, { color: theme.muted }]}>
                  Tap a line below and tell it where it goes. Usually takes 20 seconds.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={onRetryAi}
                  style={({ pressed }) => [
                    styles.leadRetry,
                    { borderColor: theme.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <ArrowCounterClockwise size={13} color={theme.text} />
                  <Text style={[styles.leadRetryText, { color: theme.text }]}>Run the AI once more</Text>
                </Pressable>
              </Card>

              <Card style={styles.degCard}>
                <View style={styles.degHead}>
                  <FileText size={13} color={theme.muted} />
                  <Text style={[styles.degHeadLabel, { color: theme.muted }]}>Text from the card</Text>
                  <Text style={[styles.degHeadRight, { color: theme.accentBright }]}>
                    {placedN > 0 ? `${placedN} of ${rawLines.length} placed` : 'tap a line to place it'}
                  </Text>
                </View>
                {rawLines.map((t, i) => {
                  const uk = used[i];
                  const guess = guessLineField(t, i);
                  const done = uk != null;
                  return (
                    <Pressable
                      key={`${g}-line${i}`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        done
                          ? `${t}, placed as ${FIELD_LABELS[uk]}`
                          : guess != null
                            ? `${t}, suggested ${FIELD_LABELS[guess]}`
                            : t
                      }
                      accessibilityHint="Choose which contact field this line goes into"
                      onPress={() => setAssign({ i, t })}
                      style={({ pressed }) => [
                        styles.degLine,
                        {
                          borderColor: done ? 'transparent' : theme.accentBorder,
                          backgroundColor: done
                            ? theme.dark
                              ? 'rgba(233,233,237,0.04)'
                              : 'rgba(41,43,49,0.04)'
                            : pressed
                              ? theme.accentTint
                              : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.degLineText, { color: done ? theme.muted : theme.accentBright }]}
                      >
                        {t}
                      </Text>
                      {done ? (
                        <View style={styles.degTag}>
                          <Check size={11} color={theme.accentBright} />
                          <Text style={[styles.degTagText, { color: theme.accentBright }]}>{FIELD_LABELS[uk]}</Text>
                        </View>
                      ) : (
                        <View style={styles.degTag}>
                          <Text style={[styles.degTagText, { color: theme.muted }]}>
                            {guess != null ? FIELD_LABELS[guess].toLowerCase() : 'choose…'}
                          </Text>
                          <PlusCircle size={13} color={theme.muted} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            </>
          )}

          {/* Identity */}
          <SectionLabel style={styles.firstSection}>Identity</SectionLabel>
          <Card style={styles.card}>
            <FieldRow
              key={`${g}-fn`}
              icon={User}
              label="First name"
              value={edit.fn}
              ai={aiSet.fn && edit.fn !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider
              onChangeText={(v) => editScalar('fn', v)}
              autoCapitalize="words"
            />
            <FieldRow
              key={`${g}-ln`}
              icon={User}
              label="Last name"
              value={edit.ln}
              ai={aiSet.ln && edit.ln !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider
              onChangeText={(v) => editScalar('ln', v)}
              autoCapitalize="words"
            />
            <FieldRow
              key={`${g}-co`}
              icon={Buildings}
              label="Company"
              value={edit.co}
              ai={aiSet.co && edit.co !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider
              onChangeText={(v) => editScalar('co', v)}
              autoCapitalize="words"
            />
            <FieldRow
              key={`${g}-jt`}
              icon={IdentificationBadge}
              label="Job title"
              value={edit.jt}
              ai={aiSet.jt && edit.jt !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider={false}
              onChangeText={(v) => editScalar('jt', v)}
              autoCapitalize="words"
            />
          </Card>

          {/* Reach */}
          <SectionLabel>Reach</SectionLabel>
          <Card style={styles.card}>
            {edit.phones.map((p, i) => (
              <FieldRow
                key={`${g}-ph${i}`}
                icon={Phone}
                label={edit.phones.length > 1 ? `Phone · ${i === 0 ? 'work' : 'mobile'}` : 'Phone'}
                value={p}
                ai={(aiSet.phones[i] ?? false) && p !== ''}
                placeholder={degraded ? '' : '+91 …'}
                warn={p !== '' && !phoneLooksValid(p) ? "Doesn't look like a number — saved as typed" : null}
                delay={nextDelay()}
                divider
                onChangeText={(v) => editEntry('phones', i, v)}
                keyboardType="phone-pad"
              />
            ))}
            {edit.emails.map((em, i) => (
              <FieldRow
                key={`${g}-em${i}`}
                icon={EnvelopeSimple}
                label="Email · work"
                value={em}
                ai={(aiSet.emails[i] ?? false) && em !== ''}
                placeholder={degraded ? '' : 'name@company.com'}
                warn={em !== '' && !emailLooksValid(em) ? 'Missing a domain ending — check the card text' : null}
                delay={nextDelay()}
                divider
                onChangeText={(v) => editEntry('emails', i, v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ))}
            <FieldRow
              key={`${g}-web`}
              icon={GlobeSimple}
              label="Website"
              value={edit.web}
              ai={aiSet.web && edit.web !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider
              onChangeText={(v) => editScalar('web', v)}
              keyboardType="url"
              autoCapitalize="none"
            />
            <View style={styles.addRow}>
              <Pressable
                accessibilityRole="button"
                hitSlop={{ top: 15, bottom: 15, left: 7, right: 7 }}
                onPress={() => addEntry('phones')}
                style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Plus size={12} color={theme.accentBright} />
                <Text style={[styles.addBtnText, { color: theme.accentBright }]}>Add phone</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                hitSlop={{ top: 15, bottom: 15, left: 7, right: 7 }}
                onPress={() => addEntry('emails')}
                style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Plus size={12} color={theme.accentBright} />
                <Text style={[styles.addBtnText, { color: theme.accentBright }]}>Add email</Text>
              </Pressable>
            </View>
          </Card>

          {/* Address */}
          <SectionLabel>Address</SectionLabel>
          <Card style={styles.card}>
            <FieldRow
              key={`${g}-ad`}
              icon={MapPin}
              label="Address"
              value={edit.ad}
              ai={aiSet.ad && edit.ad !== ''}
              placeholder={scalarPh}
              warn={null}
              delay={nextDelay()}
              divider={false}
              onChangeText={(v) => editScalar('ad', v)}
            />
          </Card>

          {!degraded && (
            <Pressable
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setRawOpen(true)}
              style={({ pressed }) => [
                styles.rawBtn,
                { borderColor: theme.divider, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <FileText size={14} color={theme.muted} />
              <Text style={[styles.rawBtnText, { color: theme.muted }]}>See the raw text the AI read</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Save bar over a bg fade */}
        <Animated.View
          style={[styles.saveBar, { transform: [{ translateY: kbLift }] }]}
          pointerEvents="box-none"
          onLayout={(e) => setSaveBarH(e.nativeEvent.layout.height)}
        >
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {kbUp ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} />
            ) : (
              <Svg width="100%" height="100%">
                <Defs>
                  <SvgLinearGradient id="revSaveFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
                    <Stop offset="0.34" stopColor={theme.bg} stopOpacity={1} />
                    <Stop offset="1" stopColor={theme.bg} stopOpacity={1} />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#revSaveFade)" />
              </Svg>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add to Contacts"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                borderColor: theme.accent,
                backgroundColor: pressed && canSave && !saving ? theme.accentTintStrong : theme.accentTint,
                opacity: saving ? 0.75 : canSave ? 1 : 0.55,
              },
            ]}
          >
            {saving ? (
              <>
                <ActivityIndicator size="small" color={theme.accentBright} style={styles.saveSpinner} />
                <Text style={[styles.saveBtnText, { color: theme.accentBright }]}>Opening iOS Contacts…</Text>
              </>
            ) : (
              <>
                <UserPlus size={17} color={theme.accentBright} />
                <Text style={[styles.saveBtnText, { color: theme.accentBright }]}>Add to Contacts</Text>
              </>
            )}
          </Pressable>
          <Text style={[styles.saveHint, { color: canSave ? theme.faint : theme.warning }]}>
            {canSave
              ? "Saving opens Apple's own New Contact form — tap Done there."
              : 'Add at least a name or a number to save this card.'}
          </Text>
        </Animated.View>
      </View>

      {/* Raw text sheet */}
      <Sheet visible={rawOpen} onClose={() => setRawOpen(false)} maxHeightPct={0.72}>
        <View style={styles.sheetHead}>
          <View style={styles.flex}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>The scan, as the AI saw it</Text>
            <Text style={[styles.sheetSub, { color: theme.muted }]}>
              Raw OCR output — kept with this scan in History
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setRawOpen(false)}
            style={({ pressed }) => [
              styles.sheetClose,
              {
                backgroundColor: theme.dark ? 'rgba(233,233,237,0.08)' : 'rgba(41,43,49,0.08)',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <X size={14} color={theme.muted} />
          </Pressable>
        </View>
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
          {imageUri != null && (
            <Image
              source={{ uri: imageUri }}
              resizeMode="cover"
              onLoad={(e) => {
                const { width, height } = e.nativeEvent.source;
                if (width > 0 && height > 0) setPhotoAr(width / height);
              }}
              style={[styles.sheetPhoto, { aspectRatio: photoAr }]}
            />
          )}
          {rawLines.map((t, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${t}`}
              onPress={() => copyLine(t)}
              style={({ pressed }) => [styles.rawRow, pressed && { backgroundColor: theme.accentTint }]}
            >
              <Text numberOfLines={1} style={[styles.rawRowText, { color: theme.accentBright }]}>
                {t}
              </Text>
              <Copy size={13} color={theme.muted} />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      {/* Assign sheet (degraded flow) */}
      <Sheet visible={assign != null} onClose={() => setAssign(null)}>
        <View style={styles.assignWrap}>
          <Text
            numberOfLines={1}
            style={[
              styles.assignLine,
              {
                color: theme.accentBright,
                backgroundColor: theme.accentTint,
                borderColor: theme.accentBorder,
              },
            ]}
          >
            {assignView?.t ?? ''}
          </Text>
          <Text style={[styles.assignLabel, { color: theme.muted }]}>Use it as</Text>
          <View style={styles.chipWrap}>
            {(['fn', 'ln', 'co', 'jt', 'phones', 'emails', 'web', 'ad', 'copy'] as const).map((k) => {
              const guessed = k !== 'copy' && k === assignGuess;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  onPress={() => assignTo(k)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: guessed || pressed ? theme.accent : theme.divider,
                      backgroundColor: guessed ? theme.accentTintStrong : 'transparent',
                    },
                  ]}
                >
                  {guessed && <Sparkle size={11} color={theme.accentBright} weight="fill" />}
                  <Text style={[styles.chipText, { color: guessed ? theme.accentBright : theme.text }]}>
                    {k === 'copy' ? 'Just copy it' : FIELD_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.assignFoot}>
            <Sparkle size={10} color={theme.accent} weight="fill" />
            <Text style={[styles.assignFootText, { color: theme.faint }]}>
              = the AI's best guess for this line
            </Text>
          </View>
        </View>
      </Sheet>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 18,
    paddingBottom: 10,
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
  headerBody: { flex: 1 },
  title: { fontSize: 21, fontFamily: font.medium, letterSpacing: -0.42 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  subText: { fontSize: 11.5, fontFamily: font.regular, flexShrink: 1 },
  thumb: { width: 58, height: 37, borderRadius: 7, borderWidth: 1, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  thumbFallback: { flex: 1, backgroundColor: '#f3f0e7' },
  thumbBar1: {
    position: 'absolute',
    top: 5,
    left: 6,
    width: 26,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22303c',
    opacity: 0.8,
  },
  thumbBar2: {
    position: 'absolute',
    top: 12,
    left: 6,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#5b6773',
    opacity: 0.6,
  },
  thumbBar3: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    right: 6,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#8a949e',
    opacity: 0.35,
  },
  scrollContent: { paddingTop: 6, paddingHorizontal: 18 },
  firstSection: { marginTop: 4 },
  card: { marginBottom: 14 },
  leadCard: {
    borderRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 15,
    paddingBottom: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  leadTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  leadTitle: { fontSize: 15, fontFamily: font.medium, marginBottom: 4, textAlign: 'center' },
  leadBody: {
    fontSize: 12.5,
    fontFamily: font.regular,
    lineHeight: 19.5,
    textAlign: 'center',
    maxWidth: 270,
    marginBottom: 11,
  },
  leadRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  leadRetryText: { fontSize: 12.5, fontFamily: font.medium },
  degCard: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  degHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  degHeadLabel: {
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    flex: 1,
    fontFamily: font.regular,
  },
  degHeadRight: { fontSize: 10.5, fontFamily: font.regular },
  degLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    marginVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  degLineText: { fontFamily: font.mono, fontSize: 12, flexShrink: 1 },
  degTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  degTagText: { fontSize: 10, fontFamily: font.medium },
  row: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    paddingTop: 9,
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 16, marginTop: 15, alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { fontSize: 10.5, letterSpacing: 0.42, textTransform: 'uppercase', fontFamily: font.regular },
  input: { fontSize: 15, fontFamily: font.regular, paddingVertical: 2, paddingHorizontal: 0 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  warnText: { fontSize: 10.5, fontFamily: font.regular, flexShrink: 1 },
  addRow: { flexDirection: 'row', gap: 14, paddingVertical: 9, paddingHorizontal: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 12.5, fontFamily: font.medium },
  rawBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  rawBtnText: { fontSize: 12.5, fontFamily: font.regular },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: BOTTOM_INSET,
    gap: 8,
  },
  saveBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveSpinner: { transform: [{ scale: 0.8 }] },
  saveBtnText: { fontSize: 15, fontFamily: font.medium },
  saveHint: { textAlign: 'center', fontSize: 11, fontFamily: font.regular },
  sheetHead: {
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: { fontSize: 15.5, fontFamily: font.medium },
  sheetSub: { fontSize: 11.5, fontFamily: font.regular },
  sheetClose: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetScroll: { flexShrink: 1 },
  sheetScrollContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 26 },
  sheetPhoto: { width: 222, borderRadius: 6, marginTop: 6, marginBottom: 14 },
  rawRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 6,
  },
  rawRowText: { fontFamily: font.mono, fontSize: 12.5, flexShrink: 1 },
  assignWrap: { paddingTop: 12, paddingHorizontal: 18, paddingBottom: 28 },
  assignLine: {
    fontFamily: font.mono,
    fontSize: 12.5,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 13,
    overflow: 'hidden',
  },
  assignLabel: {
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: font.regular,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: { fontSize: 12.5, fontFamily: font.medium },
  assignFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 },
  assignFootText: { fontSize: 10.5, fontFamily: font.regular },
});
