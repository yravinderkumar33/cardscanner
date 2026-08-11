import { useState } from 'react';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Scanner } from './components/Scanner';

// Must run before any other react-native-executorch API (module scope = app entry).
initExecutorch({ resourceFetcher: ExpoResourceFetcher });

export default function App() {
  // Remounting Scanner re-triggers model download on retry. Safe: retry is only
  // offered while phase === 'loading-models', i.e. nothing is generating.
  const [attempt, setAttempt] = useState(0);
  return (
    <SafeAreaView style={styles.root}>
      <Scanner key={attempt} onRetryModels={() => setAttempt((a) => a + 1)} />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#fff' } });
