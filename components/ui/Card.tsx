import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { font } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';

// Surface card with the Nocturne elev-sm treatment (hairline ring + soft
// ambient shadow in light mode).
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.ring,
          shadowOpacity: theme.dark ? 0 : 0.1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// Uppercase section label above grouped cards.
export function SectionLabel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.section, { color: theme.muted }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#292b31',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  section: {
    fontSize: 10.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.regular,
    marginHorizontal: 4,
    marginBottom: 7,
  },
});
