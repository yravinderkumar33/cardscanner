import { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Loading shimmer stand-in: the prototype's moving-gradient reads as an
// opacity pulse in RN without extra deps.
export function Skeleton({ style }: { style?: ViewStyle }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.55, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={[{ backgroundColor: theme.surface2, borderRadius: 5, opacity: anim }, style]}
    />
  );
}
