import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Rounded accent-tinted square holding an icon (settings rows, download list).
export function IconBadge({
  children,
  size = 30,
  radius = 8,
  style,
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.accentTintStrong,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
