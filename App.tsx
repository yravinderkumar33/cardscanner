import { useCallback, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { Inter_400Regular, Inter_500Medium, useFonts } from '@expo-google-fonts/inter';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/ui/Toast';
import { loadSettings, saveSettings } from './lib/settingsStore';
import { ThemeProvider } from './theme/ThemeContext';
import { Appearance, darkTheme, lightTheme } from './theme/tokens';

// Must run before any other react-native-executorch API (module scope = app entry).
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function App() {
  const [fontsLoaded, fontsError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
  });
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>(() => loadSettings().appearance);
  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    saveSettings({ appearance: a });
  }, []);
  // Remounting AppShell re-triggers the model download on retry. Safe: retry is
  // only offered while phase === 'setup', i.e. nothing is generating.
  const [attempt, setAttempt] = useState(0);
  const retryModels = useCallback(() => setAttempt((a) => a + 1), []);

  if (!fontsLoaded && !fontsError) {
    // Same ground ThemeProvider will pick, so the blank frame does not flash
    // dark before the light theme mounts.
    const effective = appearance === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : appearance;
    return <View style={{ flex: 1, backgroundColor: effective === 'light' ? lightTheme.bg : darkTheme.bg }} />;
  }

  return (
    <ThemeProvider appearance={appearance} setAppearance={setAppearance}>
      <ToastProvider>
        <AppShell key={attempt} onRetryModels={retryModels} />
      </ToastProvider>
    </ThemeProvider>
  );
}
