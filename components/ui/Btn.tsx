import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { font } from '../../theme/fonts';
import { useTheme } from '../../theme/ThemeContext';

export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

// The design's button family: primary = accent outline on an 8% accent tint,
// secondary = divider outline, danger = danger outline, ghost = borderless.
export function Btn({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled,
  style,
  textStyle,
  accessibilityLabel,
}: {
  label: ReactNode;
  onPress(): void;
  variant?: BtnVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}) {
  const { theme } = useTheme();
  const pad = size === 'lg' ? 13 : size === 'md' ? 10 : 8;
  const fontSize = size === 'lg' ? 15 : size === 'md' ? 13.5 : 12.5;
  const br = size === 'lg' ? 12 : size === 'md' ? 10 : 9;
  const color =
    variant === 'primary' ? theme.accentBright : variant === 'danger' ? theme.danger : theme.text;
  const borderColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.dark
          ? 'rgba(224,138,132,0.45)'
          : 'rgba(168,67,63,0.45)'
        : variant === 'ghost'
          ? 'transparent'
          : theme.divider;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      // sm keeps its visual size (~33pt tall) but extends the touch target to ~44pt.
      hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          paddingVertical: pad,
          minHeight: size === 'sm' ? undefined : 44,
          borderRadius: br,
          borderColor,
          backgroundColor:
            variant === 'primary'
              ? pressed
                ? theme.accentTintStrong
                : theme.accentTint
              : pressed
                ? theme.dark
                  ? 'rgba(233,233,237,0.07)'
                  : 'rgba(41,43,49,0.06)'
                : 'transparent',
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text style={[{ color, fontSize, fontFamily: font.medium }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  icon: { marginRight: 7 },
});
