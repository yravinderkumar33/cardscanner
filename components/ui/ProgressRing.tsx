import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

// Circular download-progress ring from the onboarding screen.
export function ProgressRing({
  size = 164,
  strokeWidth = 7,
  progress,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  /** 0..1 */
  progress: number;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  const r = (size - strokeWidth * 2) / 2 - 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.dark ? 'rgba(233,233,237,0.10)' : 'rgba(41,43,49,0.10)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - clamped)}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}
