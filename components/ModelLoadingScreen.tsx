import { Button, StyleSheet, Text, View } from 'react-native';

function Bar({ label, progress }: { label: string; progress: number }) {
  return (
    <View style={styles.barBlock}>
      <Text style={styles.barLabel}>
        {label} {Math.round(progress * 100)}%
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

export function ModelLoadingScreen({
  ocrProgress,
  llmProgress,
  error,
  onRetry,
}: {
  ocrProgress: number;
  llmProgress: number;
  error: string | null;
  onRetry(): void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preparing on-device AI</Text>
      <Text style={styles.subtitle}>One-time download (~0.5 GB) — cached after this.</Text>
      <Bar label="Text reader (OCR)" progress={ocrProgress} />
      <Bar label="Language model" progress={llmProgress} />
      {error != null && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Download failed: {error}</Text>
          <Button title="Retry" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  barBlock: { marginBottom: 16 },
  barLabel: { fontSize: 14, marginBottom: 6 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#eee', overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#2563eb' },
  errorBox: { marginTop: 24 },
  errorText: { color: '#b91c1c', marginBottom: 8 },
});
