import { Fragment, useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { font } from '../theme/fonts';
import { useTheme } from '../theme/ThemeContext';
import { Btn } from './ui/Btn';
import { Card } from './ui/Card';
import { ScreenHeader } from './ui/ScreenHeader';
import {
  AddressBook,
  AirplaneTilt,
  ArrowRight,
  Brain,
  Camera,
  Cloud,
  Cpu,
  TextAa,
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

const PIPELINE_STEPS = [
  { label: 'Photo', Icon: Camera },
  { label: 'OCR', Icon: TextAa },
  { label: 'LLM', Icon: Brain },
  { label: 'Contacts', Icon: AddressBook },
] as const;

const STATS = ['servers', 'accounts', 'ads'] as const;

const BULLETS = [
  {
    Icon: Camera,
    lead: 'The photo stays here',
    rest: " — processed in the app's memory, saved only to History.",
  },
  {
    Icon: Cpu,
    lead: 'Two pocket-size AIs',
    rest: ' — a 37 MB reader and a 493 MB language model, both living on this phone.',
  },
  {
    Icon: Cloud,
    lead: 'One download, then nothing',
    rest: ' — the models come from Hugging Face on first launch, and the AI library counts that download: app id, platform, library and model name, a country code from your language settings, and whether this is a simulator. Nothing about you or your cards is part of it.',
  },
  {
    Icon: AddressBook,
    lead: 'iOS writes the contact',
    rest: " — through Apple's own form; the app has no address-book access and never asks for any.",
  },
] as const;

export function PrivacyScreen({ onBack, onTryScan }: { onBack(): void; onTryScan(): void }) {
  const { theme } = useTheme();
  const pushIn = usePushIn();

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.bg }, pushIn]}>
      <ScreenHeader onBack={onBack} backLabel="Back to settings" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <Text style={[styles.h2, { color: theme.text }]}>
          Your cards never leave this iPhone.
        </Text>
        <Text style={[styles.sub, { color: theme.muted }]}>
          Not marketing — architecture. There is no server to send them to.
        </Text>

        <Card style={styles.pipelineCard}>
          <View style={[styles.phoneOutline, { borderColor: withAlpha(theme.accent, 0.5) }]}>
            <Text
              style={[
                styles.phoneLabel,
                { backgroundColor: theme.surface, color: theme.accentBright },
              ]}
            >
              This iPhone
            </Text>
            <View style={styles.stepRow}>
              {PIPELINE_STEPS.map(({ label, Icon }, i) => (
                <Fragment key={label}>
                  {i > 0 && <ArrowRight size={11} color={theme.muted} />}
                  <View style={[styles.step, { backgroundColor: theme.accentTint }]}>
                    <Icon size={15} color={theme.accentBright} />
                    <Text style={[styles.stepLabel, { color: theme.text }]}>{label}</Text>
                  </View>
                </Fragment>
              ))}
            </View>
          </View>
          <View style={styles.noCloudRow}>
            <View style={styles.cloudWrap}>
              <Cloud size={22} color={theme.muted} />
              <View style={[styles.cloudStrike, { backgroundColor: theme.danger }]} />
            </View>
            <Text style={[styles.noCloudText, { color: theme.muted }]}>
              No cloud step. The pipeline is physically local.
            </Text>
          </View>
        </Card>

        <View style={styles.statRow}>
          {STATS.map((s) => (
            <Card key={s} style={styles.statCard}>
              <Text style={[styles.statNum, { color: theme.accentBright }]}>0</Text>
              <Text style={[styles.statLabel, { color: theme.muted }]}>{s}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.bulletCol}>
          {BULLETS.map(({ Icon, lead, rest }) => (
            <View key={lead} style={styles.bulletRow}>
              <View style={styles.bulletIcon}>
                <Icon size={17} color={theme.accentBright} />
              </View>
              <Text style={[styles.bulletText, { color: theme.text }]}>
                <Text style={styles.bulletLead}>{lead}</Text>
                <Text style={{ color: theme.muted }}>{rest}</Text>
              </Text>
            </View>
          ))}
        </View>

        <Card style={{ ...styles.airplaneCard, borderColor: withAlpha(theme.accent, 0.3) }}>
          <View style={styles.airplaneHead}>
            <AirplaneTilt size={19} color={theme.accentBright} weight="fill" />
            <Text style={[styles.airplaneTitle, { color: theme.text }]}>
              Don't trust it — test it
            </Text>
          </View>
          <Text style={[styles.airplaneBody, { color: theme.muted }]}>
            Turn on airplane mode, scan a card, watch it work. No connection, no exceptions.
          </Text>
          <Btn
            label="Try a scan now"
            variant="primary"
            size="sm"
            onPress={onTryScan}
            style={styles.tryBtn}
          />
        </Card>

        <Text style={[styles.foot, { color: theme.faint }]}>
          Nothing to log into. Nowhere to leak from.
        </Text>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingTop: 10, paddingHorizontal: 22, paddingBottom: 44 },
  h2: {
    fontSize: 27,
    fontFamily: font.medium,
    letterSpacing: -0.54,
    lineHeight: 31,
    marginBottom: 8,
  },
  sub: { fontSize: 13.5, lineHeight: 21.5, fontFamily: font.regular, marginBottom: 20 },
  pipelineCard: {
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  phoneOutline: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  phoneLabel: {
    position: 'absolute',
    top: -8,
    left: 14,
    paddingHorizontal: 8,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: font.regular,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  step: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 3,
    gap: 3,
  },
  stepLabel: { fontSize: 10, lineHeight: 13, fontFamily: font.regular },
  noCloudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  cloudWrap: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  cloudStrike: {
    position: 'absolute',
    width: 28,
    height: 1.5,
    left: -1,
    top: 12,
    borderRadius: 1,
    transform: [{ rotate: '-38deg' }],
  },
  noCloudText: { flex: 1, fontSize: 11.5, fontFamily: font.regular },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  statNum: { fontSize: 21, fontFamily: font.medium },
  statLabel: { fontSize: 10.5, fontFamily: font.regular },
  bulletCol: { gap: 13 },
  bulletRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bulletIcon: { marginTop: 2 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19.5, fontFamily: font.regular },
  bulletLead: { fontFamily: font.medium },
  airplaneCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  airplaneHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  airplaneTitle: { fontSize: 13.5, fontFamily: font.medium },
  airplaneBody: { fontSize: 12, lineHeight: 19, fontFamily: font.regular, marginBottom: 10 },
  tryBtn: { alignSelf: 'flex-start' },
  foot: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: font.regular,
    textAlign: 'center',
    marginTop: 16,
  },
});
