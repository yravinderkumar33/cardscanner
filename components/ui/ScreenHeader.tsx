import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font } from '../../theme/fonts';
import { TOP_INSET } from '../../theme/layout';
import { useTheme } from '../../theme/ThemeContext';
import { CaretLeft } from './icons';

// Sub-screen header: round back chip + large title (History, Settings, …).
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  trailing,
}: {
  title?: string;
  subtitle?: string;
  onBack(): void;
  backLabel: string;
  trailing?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={({ pressed }) => [
          styles.back,
          { borderColor: theme.divider },
          pressed && { backgroundColor: theme.dark ? 'rgba(233,233,237,0.07)' : 'rgba(41,43,49,0.06)' },
        ]}
      >
        <CaretLeft size={17} color={theme.text} />
      </Pressable>
      {title != null && (
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          {subtitle != null && (
            <Text numberOfLines={1} style={[styles.subtitle, { color: theme.muted }]}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontFamily: font.medium, letterSpacing: -0.5 },
  subtitle: { fontSize: 11.5, fontFamily: font.regular, marginTop: 1 },
});
