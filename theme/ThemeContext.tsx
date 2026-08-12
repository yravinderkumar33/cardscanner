import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Appearance, darkTheme, lightTheme, Theme } from './tokens';

interface ThemeValue {
  theme: Theme;
  appearance: Appearance;
  setAppearance(a: Appearance): void;
}

const ThemeCtx = createContext<ThemeValue>({
  theme: darkTheme,
  appearance: 'system',
  setAppearance: () => {},
});

export function ThemeProvider({
  appearance,
  setAppearance,
  children,
}: {
  appearance: Appearance;
  setAppearance(a: Appearance): void;
  children: ReactNode;
}) {
  const systemScheme = useColorScheme();
  const value = useMemo<ThemeValue>(() => {
    const effective = appearance === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : appearance;
    return { theme: effective === 'light' ? lightTheme : darkTheme, appearance, setAppearance };
  }, [appearance, systemScheme, setAppearance]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
